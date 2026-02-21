import { exchangeAuthCode, refreshAccessToken, fetchFitnessData, parseGoogleFitData, DATA_TYPES } from '../services/googleFit.service.js';
import { findUserById, updateUser } from '../models/User.model.js';

/**
 * Get Google OAuth URL for user to authorize
 */
export const getGoogleAuthUrl = (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.location.read'
  ];

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes.join(' '))}&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=${req.user.id}`;

  return res.json({ authUrl });
};

/**
 * Handle OAuth callback and exchange code for tokens
 */
export const handleGoogleCallback = async (req, res) => {
  const { code, state } = req.query;
  const userId = state; // We passed user ID as state

  if (!code) {
    return res.status(400).json({ message: 'Authorization code missing' });
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeAuthCode(code);

    // Store tokens in user profile (you should encrypt these in production!)
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user with Google Fit tokens
    await updateUser(userId, {
      googleFit: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: tokens.scope,
        connectedAt: new Date()
      }
    });

    // Return HTML that closes the popup window
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Fit Connected</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .success-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 { margin: 0 0 1rem 0; }
            p { margin: 0 0 1.5rem 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Google Fit Connected!</h1>
            <p>This window will close automatically...</p>
          </div>
          <script>
            // Notify parent window and close
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_FIT_CONNECTED' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error handling Google callback:', error);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              background: #fee;
              color: #c00;
            }
            .container { text-align: center; padding: 2rem; }
            .error-icon { font-size: 4rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Connection Failed</h1>
            <p>${error.message}</p>
            <p><small>This window will close automatically...</small></p>
          </div>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  }
};

/**
 * Get Google Fit connection status
 */
export const getGoogleFitStatus = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isConnected = !!user.googleFit?.refreshToken;
    const connectedAt = user.googleFit?.connectedAt;
    const expiresAt = user.googleFit?.expiresAt;

    return res.json({
      connected: isConnected,
      connectedAt,
      expiresAt,
      needsRefresh: expiresAt && new Date(expiresAt) < new Date()
    });

  } catch (error) {
    console.error('Error getting Google Fit status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Disconnect Google Fit
 */
export const disconnectGoogleFit = async (req, res) => {
  const userId = req.user.id;

  try {
    await updateUser(userId, {
      googleFit: null
    });

    return res.json({
      message: 'Google Fit disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Google Fit:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Refresh Google Fit access token
 */
export const refreshGoogleFitToken = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await findUserById(userId);
    
    if (!user || !user.googleFit?.refreshToken) {
      return res.status(400).json({ 
        message: 'Google Fit not connected' 
      });
    }

    // Refresh the token
    const newTokens = await refreshAccessToken(user.googleFit.refreshToken);

    // Update user with new access token
    await updateUser(userId, {
      'googleFit.accessToken': newTokens.accessToken,
      'googleFit.expiresAt': new Date(Date.now() + newTokens.expiresIn * 1000)
    });

    return res.json({
      message: 'Token refreshed successfully',
      accessToken: newTokens.accessToken,
      expiresIn: newTokens.expiresIn
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({ 
      message: 'Failed to refresh token',
      error: error.message
    });
  }
};

/**
 * Get historical Google Fit data for a time range
 */
export const getGoogleFitHistory = async (req, res) => {
  const userId = req.user.id;
  const { startTime, endTime } = req.query;

  if (!startTime || !endTime) {
    return res.status(400).json({ 
      message: 'startTime and endTime are required' 
    });
  }

  try {
    const user = await findUserById(userId);
    
    if (!user || !user.googleFit?.accessToken) {
      return res.status(400).json({ 
        message: 'Google Fit not connected' 
      });
    }

    // Debug: log stored token info (do NOT log in production with real tokens)
    try {
      console.log('Google Fit stored token info for user', userId, {
        hasAccessToken: !!user.googleFit.accessToken,
        hasRefreshToken: !!user.googleFit.refreshToken,
        expiresAt: user.googleFit.expiresAt
      });
    } catch (e) {
      console.log('Failed to log stored token info', e);
    }

    // Check if token is expired and refresh if needed
    if (user.googleFit.expiresAt && new Date(user.googleFit.expiresAt) <= new Date()) {
      if (!user.googleFit.refreshToken) {
        return res.status(401).json({ message: 'Token expired and no refresh token available' });
      }
      console.log('Access token expired; attempting refresh for user', userId);
      const newTokens = await refreshAccessToken(user.googleFit.refreshToken);
      console.log('Refresh result received for user', userId, { accessTokenPresent: !!newTokens.accessToken, expiresIn: newTokens.expiresIn });
      await updateUser(userId, {
        'googleFit.accessToken': newTokens.accessToken,
        'googleFit.expiresAt': new Date(Date.now() + newTokens.expiresIn * 1000)
      });
      user.googleFit.accessToken = newTokens.accessToken;
    }

    // Fetch actual Google Fit data
    try {
      // Convert ISO timestamps to milliseconds for Google Fit API
      const startTimeMillis = new Date(startTime).getTime();
      const endTimeMillis = new Date(endTime).getTime();

      // Fetch data types individually to handle failures gracefully
      const fetchDataType = async (dataTypeKey, typeName) => {
        try {
          const data = await fetchFitnessData(user.googleFit.accessToken, dataTypeKey, startTimeMillis, endTimeMillis);
          return parseGoogleFitData(data, typeName);
        } catch (error) {
          console.log(`Failed to fetch ${typeName}:`, error.message);
          return []; // Return empty array on failure
        }
      };

      const [heartRates, calories] = await Promise.all([
        fetchDataType('HEART_RATE', 'heartRate'),
        fetchDataType('CALORIES', 'calories')
      ]);

      // Calculate aggregates
      const avgHeartRate = heartRates.length > 0
        ? heartRates.reduce((sum, item) => sum + item.value, 0) / heartRates.length
        : null;

      const totalCalories = calories.length > 0
        ? calories.reduce((sum, item) => sum + item.value, 0)
        : null;

      const result = {
        avgHeartRate: avgHeartRate ? Math.round(avgHeartRate * 10) / 10 : null,
        totalCalories: totalCalories ? Math.round(totalCalories * 10) / 10 : null,
        startTime,
        endTime,
        available: (avgHeartRate !== null || totalCalories !== null),
        message: (avgHeartRate !== null || totalCalories !== null)
          ? 'Data retrieved successfully'
          : 'Google Fit connected successfully, but no fitness data was recorded during this specific time period. The Google Fit app may show historical or aggregated data from other times.'
      };

      return res.json(result);

    } catch (apiError) {
      console.error('Error fetching Google Fit data:', apiError);
      return res.status(500).json({
        avgHeartRate: null,
        totalCalories: null,
        totalSteps: null,
        startTime,
        endTime,
        available: false,
        message: 'Failed to fetch Google Fit data',
        error: apiError.message
      });
    }

  } catch (error) {
    console.error('Error fetching Google Fit history:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch Google Fit data',
      error: error.message
    });
  }
};
