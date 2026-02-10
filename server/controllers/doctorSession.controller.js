import { getSessionsByAssignment, findSessionById } from '../models/Session.model.js';
import { getAssignmentsByDoctor, findAssignmentById } from '../models/Assignment.model.js';
import { findUserById } from '../models/User.model.js';

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

    // Get recent sessions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSessions = completedSessions.filter(
      s => new Date(s.startTime) > sevenDaysAgo
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
        recentSessionsCount: recentSessions.length,
        lastSessionDate: completedSessions[0]?.startTime
      },
      recentSessions: recentSessions.slice(0, 10).map(s => ({
        id: s._id,
        exerciseName: s.exerciseName,
        startTime: s.startTime,
        duration: s.analytics?.totalDuration,
        reps: s.analytics?.repsCompleted,
        formScore: s.analytics?.formQuality?.score
      })),
      assignments: patientAssignments.map(a => ({
        id: a._id,
        exerciseName: a.exerciseId?.name,
        totalSessions: a.totalSessions,
        lastSession: a.lastSessionDate,
        averagePerformance: a.averagePerformance
      }))
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
