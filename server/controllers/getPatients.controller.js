import { getPatientsByDoctor } from "../models/DoctorPatient.model.js";
import { getAssignmentsByDoctor } from "../models/Assignment.model.js";
import Session from "../models/Session.model.js";

/** Compute n-day consecutive streak from a set of date strings (YYYY-MM-DD) */
const utcDateStr = (d) => d.toISOString().split('T')[0];

function computeStreak(sessionDates) {
  const dateSet = new Set(sessionDates);
  let streak = 0;
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

export const getDoctorPatients = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const patients = await getPatientsByDoctor(doctorId);

    // Fetch all assignments for this doctor once
    const allAssignments = await getAssignmentsByDoctor(doctorId);
    const today = new Date().toISOString().split('T')[0];

    const enrichedPatients = await Promise.all(patients.map(async (patient) => {
      const pid = patient._id.toString();
      const patientAssignments = allAssignments.filter(
        a => (a.patientId?._id || a.patientId).toString() === pid
      );

      const activePlans = patientAssignments.filter(a => !a.completed).length;

      // Collect all sessions for this patient across assignments
      let allSessions = [];
      for (const a of patientAssignments) {
        const sessions = await Session.find({ assignmentId: a._id, status: 'completed' })
          .select('startTime').lean();
        allSessions.push(...sessions);
      }

      const sessionDates = allSessions.map(s => new Date(s.startTime).toISOString().split('T')[0]);
      const streak = computeStreak(sessionDates);

      const todaySessionCount = sessionDates.filter(d => d === today).length;

      const sortedDates = [...allSessions].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      const lastSessionDate = sortedDates[0]?.startTime || null;

      return {
        id: pid,
        name: patient.name,
        email: patient.email,
        role: patient.role,
        lastOnline: patient.lastOnline || null,
        streak,
        activePlans,
        totalSessions: allSessions.length,
        todaySessionCount,
        lastSessionDate,
      };
    }));

    return res.json({ patients: enrichedPatients });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
