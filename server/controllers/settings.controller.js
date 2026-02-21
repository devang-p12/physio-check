import { findUserById, updateUser } from '../models/User.model.js';

/**
 * Get user settings
 */
export const getSettings = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if Google Fit is connected
    const googleFitConnected = !!user.googleFit?.refreshToken;
    const tokenValid = !user.googleFit?.expiresAt || new Date(user.googleFit.expiresAt) > new Date();

    return res.json({
      settings: {
        smartwatchEnabled: user.settings?.smartwatchEnabled || false,
        enableRealTimeTracking: user.settings?.enableRealTimeTracking !== false,
        enableFormAnalysis: user.settings?.enableFormAnalysis !== false
      },
      googleFit: {
        connected: googleFitConnected,
        tokenValid: tokenValid,
        connectedAt: user.googleFit?.connectedAt
      }
    });

    console.log('Settings response:', {
      userId,
      googleFitConnected,
      tokenValid,
      hasRefreshToken: !!user.googleFit?.refreshToken,
      expiresAt: user.googleFit?.expiresAt
    });

  } catch (error) {
    console.error('Error getting settings:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Update user settings
 */
export const updateSettings = async (req, res) => {
  const userId = req.user.id;
  const { smartwatchEnabled, enableRealTimeTracking, enableFormAnalysis } = req.body;

  try {
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If trying to enable smartwatch, check if Google Fit is connected
    if (smartwatchEnabled && !user.googleFit?.refreshToken) {
      return res.status(400).json({ 
        message: 'Please connect Google Fit before enabling smartwatch tracking',
        requiresGoogleFit: true
      });
    }

    // Update settings
    const updateData = {
      'settings.smartwatchEnabled': smartwatchEnabled !== undefined ? smartwatchEnabled : user.settings?.smartwatchEnabled || false,
      'settings.enableRealTimeTracking': enableRealTimeTracking !== undefined ? enableRealTimeTracking : user.settings?.enableRealTimeTracking !== false,
      'settings.enableFormAnalysis': enableFormAnalysis !== undefined ? enableFormAnalysis : user.settings?.enableFormAnalysis !== false
    };

    const updatedUser = await updateUser(userId, updateData);

    return res.json({
      message: 'Settings updated successfully',
      settings: updatedUser.settings
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Toggle smartwatch tracking
 */
export const toggleSmartwatch = async (req, res) => {
  const userId = req.user.id;
  const { enabled } = req.body;

  try {
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If enabling, check Google Fit connection
    if (enabled) {
      const googleFitConnected = !!user.googleFit?.refreshToken;
      
      if (!googleFitConnected) {
        return res.status(400).json({ 
          message: 'Please connect your smartwatch via Google Fit first',
          error: 'GOOGLE_FIT_NOT_CONNECTED',
          action: 'connect_google_fit'
        });
      }

      // Check if token is expired
      if (user.googleFit.expiresAt && new Date(user.googleFit.expiresAt) < new Date()) {
        return res.status(400).json({ 
          message: 'Google Fit token expired. Please reconnect.',
          error: 'TOKEN_EXPIRED',
          action: 'refresh_token'
        });
      }
    }

    // Update setting
    const updatedUser = await updateUser(userId, {
      'settings.smartwatchEnabled': enabled
    });

    // Return full settings object
    return res.json({
      message: enabled ? 'Smartwatch tracking enabled' : 'Smartwatch tracking disabled',
      settings: {
        smartwatchEnabled: enabled,
        enableRealTimeTracking: updatedUser.settings?.enableRealTimeTracking !== false,
        enableFormAnalysis: updatedUser.settings?.enableFormAnalysis !== false
      }
    });

  } catch (error) {
    console.error('Error toggling smartwatch:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Check smartwatch status
 */
export const checkSmartwatchStatus = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const smartwatchEnabled = user.settings?.smartwatchEnabled || false;
    const googleFitConnected = !!user.googleFit?.refreshToken;
    const tokenValid = user.googleFit?.expiresAt && new Date(user.googleFit.expiresAt) > new Date();

    // Determine overall status
    let status = 'disabled';
    let message = 'Smartwatch tracking is disabled';
    let canEnable = false;

    if (!smartwatchEnabled) {
      status = 'disabled';
      message = 'Smartwatch tracking is disabled';
      canEnable = googleFitConnected && tokenValid;
    } else if (!googleFitConnected) {
      status = 'error';
      message = 'Google Fit not connected';
      canEnable = false;
    } else if (!tokenValid) {
      status = 'error';
      message = 'Google Fit token expired';
      canEnable = false;
    } else {
      status = 'active';
      message = 'Smartwatch tracking is active';
      canEnable = true;
    }

    return res.json({
      status,
      message,
      smartwatchEnabled,
      googleFitConnected,
      tokenValid,
      canEnable,
      warnings: status === 'error' ? [message] : []
    });

  } catch (error) {
    console.error('Error checking smartwatch status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
