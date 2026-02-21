import express from 'express';
import {
  getSettings,
  updateSettings,
  toggleSmartwatch,
  checkSmartwatchStatus
} from '../controllers/settings.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { patientOnly } from '../middleware/role.middleware.js';

const router = express.Router();

// Get user settings
router.get('/', auth, patientOnly, getSettings);

// Update settings
router.put('/', auth, patientOnly, updateSettings);

// Toggle smartwatch
router.post('/smartwatch/toggle', auth, patientOnly, toggleSmartwatch);

// Check smartwatch status
router.get('/smartwatch/status', auth, patientOnly, checkSmartwatchStatus);

export default router;
