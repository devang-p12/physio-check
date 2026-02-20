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
 */
export const startSession = async (req, res) => {
  const patientId = req.user.id;
  const { assignmentId, googleFitSessionId } = req.body;

  try {
    // Check if there's already an active session
    const existingSession = await getActiveSession(patientId);
    if (existingSession) {
      return res.status(400).json({
        message: 'You already have an active session. Please end it first.',
        activeSession: existingSession
      });
    }

    // Verify assignment exists and belongs to patient
    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) {
      console.log(`Assignment not found: ${assignmentId}`);
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Handle both populated and non-populated patientId
    const assignmentPatientId = assignment.patientId._id 
      ? assignment.patientId._id.toString() 
      : assignment.patientId.toString();
    
    if (assignmentPatientId !== patientId) {
      console.log(`Authorization failed: assignment.patientId=${assignmentPatientId}, requestPatientId=${patientId}`);
      return res.status(403).json({ 
        message: 'Not authorized to access this assignment'
      });
    }

    // Check user's smartwatch settings
    const user = await findUserById(patientId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const smartwatchEnabled = user.settings?.smartwatchEnabled || false;
    const googleFitConnected = !!user.googleFit?.refreshToken;

    console.log('Session start - User settings:', {
      smartwatchEnabled,
      googleFitConnected,
      hasGoogleFit: !!user.googleFit,
      hasAccessToken: !!user.googleFit?.accessToken,
      hasRefreshToken: !!user.googleFit?.refreshToken,
      expiresAt: user.googleFit?.expiresAt,
      isExpired: user.googleFit?.expiresAt ? new Date(user.googleFit.expiresAt) <= new Date() : 'no expiry'
    });

    // Prepare warnings if smartwatch enabled but prerequisites missing
    const warnings = [];
    if (smartwatchEnabled && !googleFitConnected) {
      warnings.push({
        type: 'GOOGLE_FIT_NOT_CONNECTED',
        message: 'Smartwatch tracking is enabled but Google Fit is not connected. Session will run in manual mode.',
        action: 'connect_google_fit'
      });
    }

    // Create new session
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

    console.log('Creating session with data:', JSON.stringify(sessionData, null, 2));
    const session = await createSession(sessionData);
    console.log('Session created:', session._id);

    // Link session to assignment
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
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * End an active session and generate analytics
 */
export const completeSession = async (req, res) => {
  const patientId = req.user.id;
  const { sessionId, googleFitAccessToken } = req.body;

  try {
    const session = await findSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Handle both populated and non-populated patientId
    const sessionPatientId = session.patientId._id 
      ? session.patientId._id.toString() 
      : session.patientId.toString();

    if (sessionPatientId !== patientId) {
      console.log(`Authorization failed for session complete: session.patientId=${sessionPatientId}, requestPatientId=${patientId}`);
      return res.status(403).json({ 
        message: 'Not authorized to access this session' 
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ 
        message: 'Session is not active' 
      });
    }

    // Check user's smartwatch settings
    const user = await findUserById(patientId);
    const smartwatchEnabled = user.settings?.smartwatchEnabled || false;
    const googleFitConnected = !!user.googleFit?.refreshToken;

    // Note: Google Fit data is now fetched on-demand when viewing session details
    // No need to sync data to database during session completion

    // Refresh session to get updated sensor data
    const updatedSession = await findSessionById(sessionId);

    // Generate analytics
    const analytics = generateSessionAnalytics(updatedSession);

    // Get previous sessions for comparison
    const previousSessions = await getSessionsByAssignment(session.assignmentId);
    const completedPreviousSessions = previousSessions.filter(
      s => s.status === 'completed' && s._id.toString() !== sessionId
    );

    // Compare performance
    const comparison = compareSessionPerformance(
      { analytics },
      completedPreviousSessions
    );

    // Generate insights
    const insights = generateInsights(analytics, comparison);

    // End session with analytics
    const completedSession = await endSession(sessionId, {
      ...analytics,
      insights: insights.insights,
      recommendations: insights.recommendations
    });

    console.log('Session completed:', completedSession._id, 'Status:', completedSession.status);

    // Update assignment statistics
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

/**
 * Get active session for patient
 */
export const getActive = async (req, res) => {
  const patientId = req.user.id;

  try {
    const session = await getActiveSession(patientId);

    if (!session) {
      return res.status(404).json({ message: 'No active session found' });
    }

    return res.json({ session });

  } catch (error) {
    console.error('Error getting active session:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get session history for patient
 */
export const getSessionHistory = async (req, res) => {
  const patientId = req.user.id;
  const { limit = 10, assignmentId } = req.query;

  console.log('getSessionHistory called - patientId:', patientId, 'limit:', limit, 'assignmentId:', assignmentId);

  try {
    let sessions;
    
    if (assignmentId) {
      // Get sessions for specific assignment
      sessions = await getSessionsByAssignment(assignmentId);
      console.log('Found sessions for assignment:', sessions.length);
      // Filter by patient - handle populated patientId
      sessions = sessions.filter(s => {
        const sessionPatientId = s.patientId._id ? s.patientId._id.toString() : s.patientId.toString();
        const matches = sessionPatientId === patientId;
        console.log('Session:', s._id, 'patientId:', sessionPatientId, 'matches:', matches);
        return matches;
      });
    } else {
      // Get all sessions for patient
      sessions = await getSessionsByPatient(patientId, parseInt(limit));
      console.log('Query result - sessions found:', sessions.length);
      sessions.forEach(s => {
        console.log('Session:', s._id, 'patientId:', s.patientId, 'status:', s.status, 'startTime:', s.startTime);
      });
    }

    console.log(`Returning ${sessions.length} sessions for patient ${patientId}`);

    return res.json({ 
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Error getting session history:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get detailed session analytics
 */
export const getSessionAnalytics = async (req, res) => {
  const patientId = req.user.id;
  const { sessionId } = req.params;

  try {
    const session = await findSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Handle both populated and non-populated patientId
    const sessionPatientId = session.patientId._id 
      ? session.patientId._id.toString() 
      : session.patientId.toString();

    // Patients can only see their own sessions; doctors can see any session
    if (req.user.role !== 'doctor' && sessionPatientId !== patientId) {
      console.log(`Authorization failed for analytics: session.patientId=${sessionPatientId}, requestPatientId=${patientId}`);
      return res.status(403).json({ 
        message: 'Not authorized to access this session' 
      });
    }

    // If session is still active, generate live analytics
    let analytics = session.analytics;
    if (session.status === 'active') {
      analytics = generateSessionAnalytics(session);
    }

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
