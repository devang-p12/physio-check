import { getSessionsByAssignment, findSessionById } from '../models/Session.model.js';
import { getAssignmentsByDoctor, findAssignmentById } from '../models/Assignment.model.js';
import { findUserById, updateUser } from '../models/User.model.js';
import { fetchFitnessData, parseGoogleFitData, refreshAccessToken, DATA_TYPES } from '../services/googleFit.service.js';

/**
 * Get all sessions for doctor's patients
 */
export const getDoctorPatientSessions = async (req, res) => {
  const doctorId = req.user.id;
  const { patientId, limit = 20 } = req.query;

  try {
    let assignments;
    
    if (patientId) {
      // Get assignments for specific patient
      assignments = await getAssignmentsByDoctor(doctorId);
      assignments = assignments.filter(a => a.patientId._id.toString() === patientId);
    } else {
      // Get all assignments for this doctor
      assignments = await getAssignmentsByDoctor(doctorId);
    }

    // Populate sessions for each assignment
    const assignmentsWithSessions = await Promise.all(
      assignments.map(async (assignment) => {
        const sessions = await getSessionsByAssignment(assignment._id);
        return {
          assignment: {
            id: assignment._id,
            exerciseName: assignment.exerciseId?.name,
            patientName: assignment.patientId?.name,
            patientId: assignment.patientId?._id,
            date: assignment.date,
            totalSessions: assignment.totalSessions,
            averagePerformance: assignment.averagePerformance
          },
          sessions: sessions.slice(0, parseInt(limit))
        };
      })
    );

    return res.json({
      data: assignmentsWithSessions,
      count: assignmentsWithSessions.length
    });

  } catch (error) {
    console.error('Error getting doctor patient sessions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get detailed session for monitoring
 */
export const getSessionDetails = async (req, res) => {
  const doctorId = req.user.id;
  const { sessionId } = req.params;

  try {
    const session = await findSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify doctor has access to this session
    const assignment = await findAssignmentById(session.assignmentId);
    if (!assignment || assignment.doctorId.toString() !== doctorId) {
      return res.status(403).json({ 
        message: 'Not authorized to view this session' 
      });
    }

    return res.json({
      session: {
        id: session._id,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        patient: {
          id: session.patientId._id,
          name: session.patientId.name,
          email: session.patientId.email
        },
        exercise: {
          id: assignment.exerciseId._id,
          name: assignment.exerciseId.name,
          description: assignment.exerciseId.description
        },
        analytics: session.analytics,
        sensorDataPoints: session.sensorData?.length || 0,
        // Include last 100 sensor data points for visualization
        recentSensorData: session.sensorData?.slice(-100) || []
      }
    });

  } catch (error) {
    console.error('Error getting session details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get patient performance summary
 */
export const getPatientPerformanceSummary = async (req, res) => {
  const doctorId = req.user.id;
  const { patientId } = req.params;

  try {
    // Verify doctor has access to this patient
    const assignments = await getAssignmentsByDoctor(doctorId);
    const patientAssignments = assignments.filter(
      a => a.patientId._id.toString() === patientId
    );

    if (patientAssignments.length === 0) {
      return res.status(404).json({ 
        message: 'No assignments found for this patient' 
      });
    }

    const patient = await findUserById(patientId);

    // Get all sessions across all assignments
    const allSessions = [];
    for (const assignment of patientAssignments) {
      const sessions = await getSessionsByAssignment(assignment._id);
      allSessions.push(...sessions.map(s => ({
        ...s.toObject(),
        exerciseName: assignment.exerciseId?.name,
        assignmentId: assignment._id
      })));
    }

    // Calculate overall statistics
    const completedSessions = allSessions.filter(s => s.status === 'completed');
    const totalSessions = completedSessions.length;
    
    const avgHeartRate = completedSessions.reduce((sum, s) => 
      sum + (s.analytics?.avgHeartRate || 0), 0) / (totalSessions || 1);
    
    const avgFormScore = completedSessions.reduce((sum, s) => 
      sum + (s.analytics?.formQuality?.score || 0), 0) / (totalSessions || 1);
    
    const totalReps = completedSessions.reduce((sum, s) => 
      sum + (s.analytics?.repsCompleted || 0), 0);
    
    const totalCalories = completedSessions.reduce((sum, s) => 
      sum + (s.analytics?.totalCalories || 0), 0);

    // --- Streak calculation ---
    // Build a set of unique dates (YYYY-MM-DD) that had at least one completed session
    const sessionDates = new Set(
      completedSessions.map(s => new Date(s.startTime).toISOString().split('T')[0])
    );
    let streak = 0;
    const now = new Date();
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const utcStr = (d) => d.toISOString().split('T')[0];
    const todayStr = utcStr(cursor);
    if (!sessionDates.has(todayStr)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (true) {
      const d = utcStr(cursor);
      if (sessionDates.has(d)) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        break;
      }
    }

    // All sessions sorted newest first
    const sortedSessions = [...completedSessions].sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );

    return res.json({
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email
      },
      summary: {
        totalSessions,
        totalAssignments: patientAssignments.length,
        avgHeartRate: Math.round(avgHeartRate),
        avgFormScore: Math.round(avgFormScore),
        totalReps,
        totalCalories: Math.round(totalCalories),
        streak,
        lastSessionDate: sortedSessions[0]?.startTime
      },
      allSessions: sortedSessions.map(s => ({
          id: s._id,
          exerciseName: s.exerciseName,
          startTime: s.startTime,
          duration: s.analytics?.totalDuration,
          reps: (s.analytics?.repsCompleted ?? s.analytics?.totalReps) ?? null,
          formScore: s.analytics?.formQuality?.score
        })),
      assignments: patientAssignments.map(a => {
        const prescription = (() => { try { return JSON.parse(a.prescription); } catch { return {}; } })();
        // Calculate total prescribed sessions (1 per day between startDate and endDate)
        let totalPrescribed = null;
        let remainingSessions = null;
        if (a.date && a.endDate) {
          const start = new Date(a.date);
          const end = new Date(a.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
          totalPrescribed = diffDays + 1;
          remainingSessions = Math.max(0, totalPrescribed - (a.totalSessions || 0));
        }
        return {
          id: a._id,
          exerciseName: a.exerciseId?.name,
          description: a.exerciseId?.description,
          totalSessions: a.totalSessions,
          totalPrescribed,
          remainingSessions,
          startDate: a.date,
          endDate: a.endDate,
          lastSession: a.lastSessionDate,
          prescription,
          averagePerformance: a.averagePerformance,
          completed: a.completed
        };
      })
    });

  } catch (error) {
    console.error('Error getting patient performance summary:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get assignment sessions with analytics
 */
export const getAssignmentSessions = async (req, res) => {
  const doctorId = req.user.id;
  const { assignmentId } = req.params;

  try {
    const assignment = await findAssignmentById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Verify doctor owns this assignment
    if (assignment.doctorId.toString() !== doctorId) {
      return res.status(403).json({ 
        message: 'Not authorized to view this assignment' 
      });
    }

    const sessions = await getSessionsByAssignment(assignmentId);

    return res.json({
      assignment: {
        id: assignment._id,
        exerciseName: assignment.exerciseId?.name,
        patientName: assignment.patientId?.name,
        patientId: assignment.patientId?._id,
        prescription: JSON.parse(assignment.prescription),
        totalSessions: assignment.totalSessions,
        averagePerformance: assignment.averagePerformance
      },
      sessions: sessions.map(s => ({
        id: s._id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        analytics: s.analytics,
        dataPoints: s.sensorData?.length || 0
      }))
    });

  } catch (error) {
    console.error('Error getting assignment sessions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Doctor: fetch patient's Google Fit data for a time range
 */
export const getPatientGoogleFit = async (req, res) => {
  const doctorId = req.user.id;
  const { patientId } = req.params;
  const { startTime, endTime } = req.query;

  console.log('getPatientGoogleFit called', { userId: req.user?.id, userRole: req.user?.role, patientId, startTime, endTime });

  if (req.user?.role !== 'doctor') {
    return res.status(403).json({ message: `doctor access only (you are ${req.user?.role || 'unknown'})` });
  }

  if (!startTime || !endTime) {
    return res.status(400).json({ message: 'startTime and endTime are required' });
  }

  try {
    // Verify doctor has access to this patient
    const assignments = await getAssignmentsByDoctor(doctorId);
    const hasAccess = assignments.some(a => a.patientId._id.toString() === patientId);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized to view this patient' });

    const patient = await findUserById(patientId);
    if (!patient || !patient.googleFit) {
      return res.status(400).json({ message: 'Patient has not connected Google Fit' });
    }

    // Refresh token if expired
    if (patient.googleFit.expiresAt && new Date(patient.googleFit.expiresAt) <= new Date()) {
      if (!patient.googleFit.refreshToken) {
        return res.status(401).json({ message: 'Patient access token expired and no refresh token available' });
      }
      const newTokens = await refreshAccessToken(patient.googleFit.refreshToken);
      await updateUser(patientId, {
        'googleFit.accessToken': newTokens.accessToken,
        'googleFit.expiresAt': new Date(Date.now() + newTokens.expiresIn * 1000)
      });
      patient.googleFit.accessToken = newTokens.accessToken;
    }

    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    // Fetch Heart Rate and Calories
    const hrRaw = await fetchFitnessData(patient.googleFit.accessToken, 'HEART_RATE', startMs, endMs);
    const calRaw = await fetchFitnessData(patient.googleFit.accessToken, 'CALORIES', startMs, endMs);

    const heartRates = parseGoogleFitData(hrRaw, 'heartRate');
    const calories = parseGoogleFitData(calRaw, 'calories');

    const avgHeartRate = heartRates.length > 0 ? Math.round((heartRates.reduce((s, p) => s + p.value, 0) / heartRates.length) * 10) / 10 : null;
    const totalCalories = calories.length > 0 ? Math.round(calories.reduce((s, p) => s + p.value, 0) * 10) / 10 : null;

    const available = (avgHeartRate !== null || totalCalories !== null);
    const message = available
      ? 'Data retrieved successfully'
      : 'Google Fit connected successfully, but no fitness data was recorded during this specific time period.';

    return res.json({
      avgHeartRate,
      totalCalories,
      heartRates,
      calories,
      available,
      message
    });

  } catch (error) {
    console.error('Error fetching patient Google Fit data:', error);
    return res.status(500).json({ message: 'Failed to fetch Google Fit data', error: error.message });
  }
};
