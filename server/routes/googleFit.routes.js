import express from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getGoogleFitStatus,
  disconnectGoogleFit,
  refreshGoogleFitToken,
  getGoogleFitHistory
} from '../controllers/googleFit.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { patientOnly } from '../middleware/role.middleware.js';

const router = express.Router();

// Get Google OAuth authorization URL
router.get('/auth-url', auth, patientOnly, getGoogleAuthUrl);

// Handle OAuth callback (this can be called without auth since it's a callback)
router.get('/callback', handleGoogleCallback);

// Get Google Fit connection status
router.get('/status', auth, patientOnly, getGoogleFitStatus);

// Disconnect Google Fit
router.delete('/disconnect', auth, patientOnly, disconnectGoogleFit);

// Refresh access token
router.post('/refresh-token', auth, patientOnly, refreshGoogleFitToken);

// Get historical Google Fit data
router.get('/history', auth, patientOnly, getGoogleFitHistory);

export default router;
