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
 * Generate a comprehensive report for a patient
 * Query params: startDate, endDate, exerciseIds (comma-separated, optional)
 */
export const generatePatientReport = async (req, res) => {
  const doctorId = req.user.id;
  const { patientId } = req.params;
  const { startDate, endDate, exerciseIds } = req.query;

  try {
    // Verify doctor has access
    const allAssignments = await getAssignmentsByDoctor(doctorId);
    let patientAssignments = allAssignments.filter(
      a => a.patientId._id.toString() === patientId
    );
    if (patientAssignments.length === 0) {
      return res.status(404).json({ message: 'No assignments found for this patient' });
    }

    // Optional exercise filter
    const exIds = exerciseIds ? exerciseIds.split(',').map(s => s.trim()).filter(Boolean) : null;
    if (exIds && exIds.length > 0) {
      patientAssignments = patientAssignments.filter(
        a => exIds.includes(a.exerciseId?._id?.toString())
      );
    }

    const patient = await findUserById(patientId);

    // Build date filter
    const filterStart = startDate ? new Date(startDate) : null;
    const filterEnd = endDate ? (() => { const d = new Date(endDate); d.setHours(23,59,59,999); return d; })() : null;

    // Gather all completed sessions within date window
    const allSessions = [];
    for (const assignment of patientAssignments) {
      const sessions = await getSessionsByAssignment(assignment._id);
      for (const s of sessions) {
        if (s.status !== 'completed') continue;
        if (filterStart && new Date(s.startTime) < filterStart) continue;
        if (filterEnd && new Date(s.startTime) > filterEnd) continue;
        allSessions.push({
          ...s.toObject(),
          exerciseName: assignment.exerciseId?.name,
          exerciseId: assignment.exerciseId?._id?.toString(),
          prescription: (() => { try { return JSON.parse(assignment.prescription); } catch { return {}; } })()
        });
      }
    }

    allSessions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const total = allSessions.length;

    // ── Duration: always compute from timestamps, not analytics ──
    const totalDurationSec = allSessions.reduce((acc, s) => {
      if (s.endTime && s.startTime) {
        return acc + Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000);
      }
      return acc + (s.analytics?.totalDuration || 0);
    }, 0);

    // ── Reps: analytics.repsCompleted, fall back to prescription sets*reps ──
    const totalReps = allSessions.reduce((acc, s) => {
      if (s.analytics?.repsCompleted > 0) return acc + s.analytics.repsCompleted;
      // fall back: prescribed sets * repsPerSet
      const p = s.prescription || {};
      const sets = p.sets || 0;
      const rpe = p.repsPerSet || 0;
      return acc + (sets * rpe);
    }, 0);

    // ── Sessions-based HR/calories (sensor-tracked sessions only) ──
    const sessionsWithHR = allSessions.filter(s => s.analytics?.avgHeartRate);
    const sessionAvgHR = sessionsWithHR.length
      ? Math.round(sessionsWithHR.reduce((sum, s) => sum + s.analytics.avgHeartRate, 0) / sessionsWithHR.length)
      : null;
    const sessionTotalCalories = Math.round(allSessions.reduce((acc, s) => acc + (s.analytics?.totalCalories || 0), 0));

    // ── Google Fit: fetch for the report period ──
    let googleFit = null;
    const gfStart = filterStart || (allSessions.length ? new Date(allSessions[0].startTime) : null);
    const gfEnd = filterEnd || new Date();

    if (gfStart && patient?.googleFit?.refreshToken) {
      try {
        // Refresh token if expired
        let accessToken = patient.googleFit.accessToken;
        if (patient.googleFit.expiresAt && new Date(patient.googleFit.expiresAt) <= new Date()) {
          const newTokens = await refreshAccessToken(patient.googleFit.refreshToken);
          await updateUser(patientId, {
            'googleFit.accessToken': newTokens.accessToken,
            'googleFit.expiresAt': new Date(Date.now() + newTokens.expiresIn * 1000)
          });
          accessToken = newTokens.accessToken;
        }

        const startMs = gfStart.getTime();
        const endMs = gfEnd.getTime();

        const DAY_MS = 86_400_000;
        const [hrRaw, calRaw, stepsRaw] = await Promise.allSettled([
          // HR: one big bucket → average of all readings
          fetchFitnessData(accessToken, 'HEART_RATE', startMs, endMs),
          // Calories: DAILY buckets → one merged total per day → sum = accurate total
          fetchFitnessData(accessToken, 'CALORIES', startMs, endMs, DAY_MS),
          fetchFitnessData(accessToken, 'DISTANCE', startMs, endMs),
        ]);

        const heartRates = hrRaw.status === 'fulfilled' ? parseGoogleFitData(hrRaw.value, 'heartRate') : [];
        // For daily-bucketed calories each point is already the day's merged total — just sum them
        const calPoints = calRaw.status === 'fulfilled' ? parseGoogleFitData(calRaw.value, 'calories') : [];
        const steps = stepsRaw.status === 'fulfilled' ? parseGoogleFitData(stepsRaw.value, 'distance') : [];

        const avgHR = heartRates.length
          ? Math.round(heartRates.reduce((s, p) => s + p.value, 0) / heartRates.length * 10) / 10
          : null;
        // Round to 1 decimal, cap obviously-wrong values (>10000 kcal/day average = bad data)
        const rawCalSum = calPoints.reduce((s, p) => s + p.value, 0);
        const days = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
        const avgCalPerDay = rawCalSum / days;
        // com.google.calories.expended includes BMR; realistic active+BMR is 1500-4000 kcal/day
        // If average exceeds 5000/day the data source is likely duplicated — take per-day dedup approach
        const totalCal = calPoints.length
          ? (avgCalPerDay > 5000
              // fallback: cap at a sensible estimate
              ? Math.round(Math.min(rawCalSum, days * 3500) * 10) / 10
              : Math.round(rawCalSum * 10) / 10)
          : null;
        const totalDist = steps.length
          ? Math.round(steps.reduce((s, p) => s + p.value, 0))
          : null;

        // Per-week HR series for chart
        const weeklyHR = {};
        for (const p of heartRates) {
          const d = new Date(p.timestamp);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const wKey = weekStart.toISOString().split('T')[0];
          if (!weeklyHR[wKey]) weeklyHR[wKey] = [];
          weeklyHR[wKey].push(p.value);
        }
        const heartRateByWeek = Object.entries(weeklyHR).map(([week, vals]) => ({
          week,
          avgHeartRate: Math.round(vals.reduce((a,b) => a+b,0) / vals.length)
        })).sort((a,b) => new Date(a.week) - new Date(b.week));

        googleFit = {
          connected: true,
          avgHeartRate: avgHR,
          totalCalories: totalCal,
          totalDistanceMeters: totalDist,
          dataPoints: heartRates.length,
          heartRateByWeek,
        };
      } catch (gfErr) {
        console.error('Google Fit fetch error in report:', gfErr.message);
        googleFit = { connected: true, error: gfErr.message };
      }
    } else {
      googleFit = { connected: !!(patient?.googleFit?.refreshToken) };
    }

    // Resolved HR/calories (Google Fit takes priority, fall back to session analytics)
    const resolvedHR = googleFit?.avgHeartRate ?? sessionAvgHR;
    const resolvedCalories = googleFit?.totalCalories ?? sessionTotalCalories;

    // ── Streak ──
    const sessionDates = new Set(allSessions.map(s => new Date(s.startTime).toISOString().split('T')[0]));
    let streak = 0;
    const now = new Date();
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const utcStr = (d) => d.toISOString().split('T')[0];
    if (!sessionDates.has(utcStr(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (sessionDates.has(utcStr(cursor))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }

    // ── Adherence ──
    let totalPrescribed = 0;
    for (const a of patientAssignments) {
      if (!a.date) continue;
      const start = filterStart ? new Date(Math.max(filterStart, new Date(a.date))) : new Date(a.date);
      const end = filterEnd ? new Date(Math.min(filterEnd, a.endDate ? new Date(a.endDate) : new Date())) : (a.endDate ? new Date(a.endDate) : new Date());
      if (end >= start) totalPrescribed += Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }
    const adherenceRate = totalPrescribed > 0 ? Math.min(100, Math.round((total / totalPrescribed) * 100)) : null;

    // ── Per-exercise breakdown ──
    const exerciseMap = {};
    for (const s of allSessions) {
      const key = s.exerciseId || s.exerciseName;
      if (!exerciseMap[key]) {
        exerciseMap[key] = { name: s.exerciseName, sessions: 0, totalReps: 0, totalDuration: 0, heartRates: [], calories: 0, issues: {} };
      }
      const e = exerciseMap[key];
      e.sessions++;
      const repsVal = (s.analytics?.repsCompleted > 0)
        ? s.analytics.repsCompleted
        : (((s.prescription?.sets || 0) * (s.prescription?.repsPerSet || 0)));
      e.totalReps += repsVal;
      // Duration from timestamps
      const dur = (s.endTime && s.startTime)
        ? Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000)
        : (s.analytics?.totalDuration || 0);
      e.totalDuration += dur;
      if (s.analytics?.avgHeartRate) e.heartRates.push(s.analytics.avgHeartRate);
      e.calories += s.analytics?.totalCalories || 0;
      for (const issue of (s.analytics?.formQuality?.issues || [])) {
        e.issues[issue] = (e.issues[issue] || 0) + 1;
      }
    }
    const exerciseBreakdown = Object.values(exerciseMap).map(e => ({
      name: e.name,
      sessions: e.sessions,
      totalReps: e.totalReps,
      totalDurationSec: e.totalDuration,
      avgHeartRate: e.heartRates.length ? Math.round(e.heartRates.reduce((a, b) => a + b, 0) / e.heartRates.length) : null,
      totalCalories: Math.round(e.calories),
      topIssues: Object.entries(e.issues).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([issue, count]) => ({ issue, count }))
    }));

    // ── Timeline for charts ──
    const timeline = allSessions.map(s => {
      const dur = (s.endTime && s.startTime)
        ? Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000)
        : (s.analytics?.totalDuration ?? null);
      const p = s.prescription || {};
      const reps = (s.analytics?.repsCompleted > 0)
        ? s.analytics.repsCompleted
        : ((p.sets || 0) * (p.repsPerSet || 0)) || null;
      return {
        date: new Date(s.startTime).toISOString().split('T')[0],
        exerciseName: s.exerciseName,
        reps,
        heartRate: s.analytics?.avgHeartRate ?? null,
        calories: s.analytics?.totalCalories ?? null,
        durationMin: dur ? Math.round(dur / 60 * 10) / 10 : null
      };
    });

    // ── Sessions per day (for activity graph) ──
    const dayMap = {};
    for (const s of allSessions) {
      const day = new Date(s.startTime).toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = { date: day, sessions: 0, totalDurationMin: 0 };
      dayMap[day].sessions++;
      const dur = (s.endTime && s.startTime)
        ? Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000)
        : (s.analytics?.totalDuration || 0);
      dayMap[day].totalDurationMin += Math.round(dur / 60 * 10) / 10;
    }
    const sessionsPerDay = Object.values(dayMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── Intensity zones aggregate ──
    const zones = { low: 0, moderate: 0, high: 0, peak: 0 };
    for (const s of allSessions) {
      if (s.analytics?.intensityZones) {
        zones.low += s.analytics.intensityZones.low || 0;
        zones.moderate += s.analytics.intensityZones.moderate || 0;
        zones.high += s.analytics.intensityZones.high || 0;
        zones.peak += s.analytics.intensityZones.peak || 0;
      }
    }

    // ── Week-by-week ──
    const weekMap = {};
    for (const s of allSessions) {
      const d = new Date(s.startTime);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const wKey = weekStart.toISOString().split('T')[0];
      if (!weekMap[wKey]) weekMap[wKey] = { week: wKey, sessions: 0, totalReps: 0, totalDurationSec: 0, heartRates: [] };
      weekMap[wKey].sessions++;
      const weekReps = (s.analytics?.repsCompleted > 0)
        ? s.analytics.repsCompleted
        : (((s.prescription?.sets || 0) * (s.prescription?.repsPerSet || 0)));
      weekMap[wKey].totalReps += weekReps;
      const dur = (s.endTime && s.startTime)
        ? Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000)
        : (s.analytics?.totalDuration || 0);
      weekMap[wKey].totalDurationSec += dur;
      if (s.analytics?.avgHeartRate) weekMap[wKey].heartRates.push(s.analytics.avgHeartRate);
    }
    const weeklyBreakdown = Object.values(weekMap)
      .sort((a, b) => new Date(a.week) - new Date(b.week))
      .map(w => ({
        week: w.week,
        sessions: w.sessions,
        totalReps: w.totalReps,
        totalDurationSec: w.totalDurationSec,
        avgHeartRate: w.heartRates.length ? Math.round(w.heartRates.reduce((a, b) => a + b, 0) / w.heartRates.length) : null
      }));

    // Merge Google Fit weekly HR into weeklyBreakdown
    if (googleFit?.heartRateByWeek?.length) {
      const gfWeekMap = {};
      for (const w of googleFit.heartRateByWeek) gfWeekMap[w.week] = w.avgHeartRate;
      for (const w of weeklyBreakdown) {
        if (!w.avgHeartRate && gfWeekMap[w.week]) w.avgHeartRate = gfWeekMap[w.week];
      }
    }

    // ── Top global posture issues ──
    const globalIssues = {};
    for (const s of allSessions) {
      for (const issue of (s.analytics?.formQuality?.issues || [])) {
        globalIssues[issue] = (globalIssues[issue] || 0) + 1;
      }
    }
    const topIssues = Object.entries(globalIssues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));

    return res.json({
      patient: { id: patient._id, name: patient.name, email: patient.email },
      filters: { startDate: startDate || null, endDate: endDate || null, exerciseIds: exIds },
      googleFit,
      summary: {
        totalSessions: total,
        totalPrescribed,
        adherenceRate,
        avgHeartRate: resolvedHR,
        totalCalories: resolvedCalories,
        totalReps,
        totalDurationSec,
        streak,
        intensityZones: zones
      },
      exerciseBreakdown,
      timeline,
      sessionsPerDay,
      weeklyBreakdown,
      topIssues,
      availableExercises: patientAssignments.map(a => ({
        id: a.exerciseId?._id?.toString(),
        name: a.exerciseId?.name
      })).filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i)
    });

  } catch (error) {
    console.error('Error generating patient report:', error);
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
