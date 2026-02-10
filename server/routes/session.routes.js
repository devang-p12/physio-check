import express from 'express';
import {
  startSession,
  completeSession,
  getActive,
  getSessionHistory,
  getSessionAnalytics
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

// Get session analytics
router.get('/:sessionId/analytics', auth, patientOnly, getSessionAnalytics);

export default router;
