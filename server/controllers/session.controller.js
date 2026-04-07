import {
  createSession,
  findSessionById,
  getSessionsByPatient,
  getActiveSession,
  endSession,
  getSessionsByAssignment
} from '../models/Session.model.js';
import { findAssignmentById, addSessionToAssignment, updateAssignmentStats } from '../models/Assignment.model.js';
import { findUserById } from '../models/User.model.js';
import {
  generateSessionAnalytics,
  compareSessionPerformance,
  generateInsights
} from '../services/analytics.service.js';

/**
 * Start a new exercise session
 * (no changes from original)
 */
export const startSession = async (req, res) => {
  const patientId = req.user.id;
  const { assignmentId, googleFitSessionId } = req.body;

  try {
    const existingSession = await getActiveSession(patientId);
    if (existingSession) {
      console.log(`Auto-completing stale active session ${existingSession._id} before starting new one`);
      await endSession(existingSession._id.toString(), {});
    }

    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const assignmentPatientId = assignment.patientId._id
      ? assignment.patientId._id.toString()
      : assignment.patientId.toString();

    if (assignmentPatientId !== patientId) {
      return res.status(403).json({ message: 'Not authorized to access this assignment' });
    }

    const user = await findUserById(patientId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const smartwatchEnabled = user.settings?.smartwatchEnabled || false;
    const googleFitConnected = !!user.googleFit?.refreshToken;

    const warnings = [];
    if (smartwatchEnabled && !googleFitConnected) {
      warnings.push({
        type: 'GOOGLE_FIT_NOT_CONNECTED',
        message: 'Smartwatch tracking is enabled but Google Fit is not connected. Session will run in manual mode.',
        action: 'connect_google_fit'
      });
    }

    const sessionData = {
      assignmentId,
      patientId,
      startTime: new Date(),
      status: 'active',
      sensorData: [],
      requiresSensorData: smartwatchEnabled && googleFitConnected,
      googleFitData: (googleFitSessionId && smartwatchEnabled && googleFitConnected) ? {
        sessionId: googleFitSessionId,
        syncedAt: new Date()
      } : undefined
    };

    const session = await createSession(sessionData);
    await addSessionToAssignment(assignmentId, session._id);

    return res.status(201).json({
      message: 'Session started successfully',
      session: {
        id: session._id,
        assignmentId: session.assignmentId,
        startTime: session.startTime,
        status: session.status,
        requiresSensorData: session.requiresSensorData,
        mode: smartwatchEnabled ? (googleFitConnected ? 'tracked' : 'manual') : 'manual'
      },
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * End an active session and generate analytics.
 *
 * NEW body fields accepted (all optional):
 *   Stretch mode only:
 *     allocatedDuration      {number}  seconds the patient chose to hold
 *     correctPostureSeconds  {number}  seconds posture was "correct"
 *     postureAccuracy        {number}  percentage correct (0-100)
 *   All modes:
 *     dominantEmotion        {string}  most-detected emotion label
 *     emotionCounts          {object}  e.g. { happy: 14, neutral: 6 }
 */
export const completeSession = async (req, res) => {
  const patientId = req.user.id;
  const {
    sessionId,
    googleFitAccessToken,
    reps,
    formScore,
    bestStretchDist,
    // ── NEW ──
    allocatedDuration,
    correctPostureSeconds,
    postureAccuracy,
    dominantEmotion,
    emotionCounts,
  } = req.body;

  try {
    const session = await findSessionById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const sessionPatientId = session.patientId._id
      ? session.patientId._id.toString()
      : session.patientId.toString();

    if (sessionPatientId !== patientId) {
      return res.status(403).json({ message: 'Not authorized to access this session' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Session is not active' });
    }

    // ── Detect exercise mode from the populated assignment ────────────
    const exerciseMode =
      session.assignmentId?.exerciseId?.exerciseMode ||
      session.assignmentId?.customTemplateId?.exerciseMode ||
      'workout';
    const isStretch = exerciseMode === 'stretch';

    const updatedSession = await findSessionById(sessionId);
    const generatedAnalytics = generateSessionAnalytics(updatedSession);

    const baseAnalytics = generatedAnalytics.error
      ? { totalDuration: Math.round((new Date() - new Date(updatedSession.startTime)) / 1000) }
      : generatedAnalytics;

    // ── Merge all analytics ───────────────────────────────────────────
    const analytics = {
      ...baseAnalytics,

      // Reps: omit entirely for stretch sessions
      repsCompleted: isStretch
        ? undefined
        : (reps !== undefined ? Number(reps) : baseAnalytics.repsCompleted),

      bestStretchDist: bestStretchDist !== undefined
        ? Number(bestStretchDist)
        : baseAnalytics.bestStretchDist,

      formQuality: {
        ...(baseAnalytics.formQuality || {}),
        score: formScore !== undefined ? Number(formScore) : baseAnalytics.formQuality?.score
      },

      // Stretch-specific fields
      ...(isStretch && allocatedDuration !== undefined      && { allocatedDuration: Number(allocatedDuration) }),
      ...(isStretch && correctPostureSeconds !== undefined  && { correctPostureSeconds: Number(correctPostureSeconds) }),
      ...(isStretch && postureAccuracy !== undefined        && { postureAccuracy: Number(postureAccuracy) }),

      // Emotion analytics — always include when provided
      ...(dominantEmotion && { dominantEmotion }),
      ...(emotionCounts && typeof emotionCounts === 'object' && {
        emotionCounts: new Map(
          Object.entries(emotionCounts).map(([k, v]) => [k, Number(v)])
        )
      }),
    };

    const previousSessions = await getSessionsByAssignment(session.assignmentId);
    const completedPreviousSessions = previousSessions.filter(
      s => s.status === 'completed' && s._id.toString() !== sessionId
    );

    const comparison = compareSessionPerformance({ analytics }, completedPreviousSessions);
    const insights = generateInsights(analytics, comparison);

    const completedSession = await endSession(sessionId, {
      ...analytics,
      insights: insights.insights,
      recommendations: insights.recommendations
    });

    console.log('Session completed:', completedSession._id, 'Status:', completedSession.status);
    await updateAssignmentStats(session.assignmentId, analytics);

    return res.json({
      message: 'Session completed successfully',
      session: completedSession,
      comparison,
      insights
    });

  } catch (error) {
    console.error('Error completing session:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/** Get active session — unchanged */
export const getActive = async (req, res) => {
  const patientId = req.user.id;
  try {
    const session = await getActiveSession(patientId);
    if (!session) return res.status(404).json({ message: 'No active session found' });
    return res.json({ session });
  } catch (error) {
    console.error('Error getting active session:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/** Get session history — unchanged */
export const getSessionHistory = async (req, res) => {
  const patientId = req.user.id;
  const { limit = 10, assignmentId } = req.query;
  try {
    let sessions;
    if (assignmentId) {
      sessions = await getSessionsByAssignment(assignmentId);
      sessions = sessions.filter(s => {
        const id = s.patientId._id ? s.patientId._id.toString() : s.patientId.toString();
        return id === patientId;
      });
    } else {
      sessions = await getSessionsByPatient(patientId, parseInt(limit));
    }
    return res.json({ sessions, count: sessions.length });
  } catch (error) {
    console.error('Error getting session history:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPatientHistoryForDoctor = async (req, res) => {
  const { patientId } = req.params;

  try {
    const sessions = await getSessionsByPatient(patientId);

    return res.json({
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Error fetching patient history (doctor):', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/** Get detailed session analytics — unchanged */
export const getSessionAnalytics = async (req, res) => {
  const patientId = req.user.id;
  const { sessionId } = req.params;
  try {
    const session = await findSessionById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const sessionPatientId = session.patientId._id
      ? session.patientId._id.toString()
      : session.patientId.toString();

    if (req.user.role !== 'doctor' && sessionPatientId !== patientId) {
      return res.status(403).json({ message: 'Not authorized to access this session' });
    }

    let analytics = session.analytics;
    if (session.status === 'active') analytics = generateSessionAnalytics(session);

    return res.json({
      session: {
        id: session._id,
        assignmentId: session.assignmentId,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        requiresSensorData: session.requiresSensorData,
        dataPointsCollected: session.sensorData?.length || 0
      },
      analytics
    });
  } catch (error) {
    console.error('Error getting session analytics:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};