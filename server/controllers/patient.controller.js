import { getAssignmentsByPatient, findAssignmentById } from "../models/Assignment.model.js";
import Session from "../models/Session.model.js";

const utcDateStr = (d) => d.toISOString().split('T')[0];

function computeStreak(sessionDates) {
  const dateSet = new Set(sessionDates);
  let streak = 0;
  // Always work in UTC so stored session dates match
  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayStr = utcDateStr(cursor);
  if (!dateSet.has(todayStr)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (true) {
    const d = utcDateStr(cursor);
    if (dateSet.has(d)) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    else break;
  }
  return streak;
}

export const getTodaysExercises = async (req, res) => {
  const patientId = req.user.id;
  const today = new Date().toISOString().split("T")[0];

  try {
    const allAssignments = await getAssignmentsByPatient(patientId);

    const todaysExercises = allAssignments.filter((a) => {
      const assignmentDate = new Date(a.date).toISOString().split("T")[0];
      return assignmentDate === today;
    });

    // Compute streak + total sessions across all assignments
    const allSessions = await Session.find({ patientId, status: 'completed' })
      .select('startTime assignmentId').lean();
    const sessionDates = allSessions.map(s => new Date(s.startTime).toISOString().split('T')[0]);
    const streak = computeStreak(sessionDates);
    const totalSessions = allSessions.length;

    // Build set of assignmentIds that have a completed session today
    const completedTodayIds = new Set(
      allSessions
        .filter(s => new Date(s.startTime).toISOString().split('T')[0] === today)
        .map(s => s.assignmentId?.toString())
    );

    // Build calendar: counts per day for last 56 days (8 weeks)
    const dateCountMap = {};
    for (const d of sessionDates) dateCountMap[d] = (dateCountMap[d] || 0) + 1;
    const now = new Date();
    const calendar = {};
    for (let i = 55; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      const key = d.toISOString().split('T')[0];
      calendar[key] = dateCountMap[key] || 0;
    }

    return res.json({
      streak,
      totalSessions,
      calendar,
      exercises: todaysExercises.map(exercise => ({
        id: exercise._id.toString(),
        doctorId: exercise.doctorId
          ? (exercise.doctorId._id ? exercise.doctorId._id.toString() : exercise.doctorId.toString())
          : null,
        patientId: exercise.patientId
          ? (exercise.patientId._id ? exercise.patientId._id.toString() : exercise.patientId.toString())
          : null,
        exerciseId: exercise.exerciseId
          ? (exercise.exerciseId._id ? exercise.exerciseId._id.toString() : exercise.exerciseId.toString())
          : null,
        date: exercise.date,
        prescription: JSON.parse(exercise.prescription),
        completed: exercise.completed,
        completedToday: completedTodayIds.has(exercise._id.toString()),
        performance: exercise.performance,
        doctor: exercise.doctorId && exercise.doctorId._id ? {
          id: exercise.doctorId._id.toString(),
          name: exercise.doctorId.name,
          email: exercise.doctorId.email
        } : null,
        exercise: exercise.exerciseId && exercise.exerciseId._id ? {
          id: exercise.exerciseId._id.toString(),
          name: exercise.exerciseId.name,
          reps: exercise.exerciseId.reps,
          duration: exercise.exerciseId.duration,
          description: exercise.exerciseId.description
        } : null,
        // Custom exercise template info (no frames — just metadata for the card)
        customTemplateId: exercise.customTemplateId
          ? (exercise.customTemplateId._id
              ? exercise.customTemplateId._id.toString()
              : exercise.customTemplateId.toString())
          : null,
        customTemplate: exercise.customTemplateId && exercise.customTemplateId._id ? {
          id: exercise.customTemplateId._id.toString(),
          name: exercise.customTemplateId.name,
          description: exercise.customTemplateId.description,
          category: exercise.customTemplateId.category,
          durationSeconds: exercise.customTemplateId.durationSeconds,
        } : null,
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAssignment = async (req, res) => {
  const patientId = req.user.id;
  const { assignmentId } = req.params;

  try {
    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const assignmentPatientId = assignment.patientId._id ? assignment.patientId._id.toString() : assignment.patientId.toString();
    if (assignmentPatientId !== patientId) return res.status(403).json({ message: 'Not authorized to access this assignment' });

    return res.json({ assignment: {
      id: assignment._id.toString(),
      date: assignment.date,
      endDate: assignment.endDate,
      prescription: JSON.parse(assignment.prescription),
      completed: assignment.completed,
      totalSessions: assignment.totalSessions,
      averagePerformance: assignment.averagePerformance,
      exercise: assignment.exerciseId && assignment.exerciseId._id ? {
        id: assignment.exerciseId._id.toString(),
        name: assignment.exerciseId.name,
        reps: assignment.exerciseId.reps,
        duration: assignment.exerciseId.duration,
        description: assignment.exerciseId.description
      } : null,
      customTemplateId: assignment.customTemplateId
        ? (assignment.customTemplateId._id
            ? assignment.customTemplateId._id.toString()
            : assignment.customTemplateId.toString())
        : null,
    } });
  } catch (error) {
    console.error('Error in getAssignment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export const getAssignmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🔍 Searching for Assignment ID:", id);

    const assignment = await findAssignmentById(id);

    if (!assignment) {
      console.log("❌ NOT FOUND: No assignment exists with that ID.");
      return res.status(404).json({ message: "Assignment not found in database" });
    }

    console.log("✅ FOUND: Assignment exists. Now populating exercise...");
    const populated = await assignment.populate("exerciseId");
    
    res.json({
      exercise: populated.exerciseId,
      prescription: populated.prescription
    });
  } catch (error) {
    console.error("🔥 DATABASE CRASH:", error.message);
    res.status(500).json({ message: "Server error during DB query" });
  }
};
