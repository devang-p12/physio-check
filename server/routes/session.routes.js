import express from 'express';
import {
  startSession,
  completeSession,
  getActive,
  getSessionHistory,
  getSessionAnalytics,
  getPatientHistoryForDoctor
} from '../controllers/session.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { patientOnly } from '../middleware/role.middleware.js';

const router = express.Router();

// Start a new session
router.post('/start', auth, patientOnly, startSession);

// Complete/end a session
router.post('/complete', auth, patientOnly, completeSession);

// Get active session
router.get('/active', auth, patientOnly, getActive);

// Get session history
router.get('/history', auth, patientOnly, getSessionHistory);

router.get('/doctor/patient/:patientId/history', auth, getPatientHistoryForDoctor);

// Get session analytics — accessible by both patient (own session) and doctor
router.get('/:sessionId/analytics', auth, getSessionAnalytics);

export default router;
