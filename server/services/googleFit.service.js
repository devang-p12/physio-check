/**
 * Google Fit API Integration Service
 *
 * This service handles OAuth authentication and data fetching from Google Fit.
 * You'll need to set up OAuth 2.0 credentials in Google Cloud Console.
 *
 * Required scopes:
 * - https://www.googleapis.com/auth/fitness.activity.read
 * - https://www.googleapis.com/auth/fitness.body.read
 * - https://www.googleapis.com/auth/fitness.heart_rate.read
 * - https://www.googleapis.com/auth/fitness.location.read
 */

// Google Fit data types and sources
const DATA_TYPES = {
  HEART_RATE: 'com.google.heart_rate.bpm',
  CALORIES: 'com.google.calories.expended',
  DISTANCE: 'com.google.distance.delta',
  SPEED: 'com.google.speed',
  ACTIVITY: 'com.google.activity.segment',
  LOCATION: 'com.google.location.sample',
  HEIGHT: 'com.google.height',
  WEIGHT: 'com.google.weight'
};

// Common Google Fit data source IDs
const DATA_SOURCES = {
  HEART_RATE: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
  CALORIES: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended'
};

/**
 * Exchange authorization code for access token
 */
export const exchangeAuthCode = async (authCode) => {
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  
  const params = new URLSearchParams({
    code: authCode,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope
    };
  } catch (error) {
    console.error('Error exchanging auth code:', error);
    throw error;
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken) => {
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    console.log(`Refresh token endpoint response: ${response.status} ${response.statusText}`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      console.log('Refresh token response body:', JSON.stringify(data, null, 2));
      if (!response.ok) {
        throw new Error(`Refresh token failed: ${response.status} ${response.statusText}`);
      }
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in
      };
    } catch (parseErr) {
      console.error('Failed to parse refresh token response:', text);
      throw new Error('Failed to refresh access token');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
};

/**
 * Fetch fitness data from Google Fit using the Aggregate API.
 * This queries ALL data sources for a given data type, which is far more
 * reliable than querying a single data source stream.
 * @param {number} [bucketDurationMs] - bucket size in ms. Defaults to the full range (one bucket).
 *   Pass 86400000 for daily buckets (recommended for calorie totals).
 */
export const fetchFitnessData = async (accessToken, dataTypeKey, startTimeMs, endTimeMs, bucketDurationMs) => {
  const dataType = DATA_TYPES[dataTypeKey];

  console.log(`Fetching ${dataTypeKey} (${dataType}) via aggregate API`);
  console.log(`Time range: ${new Date(startTimeMs).toISOString()} → ${new Date(endTimeMs).toISOString()}`);

  const effectiveBucket = bucketDurationMs || (endTimeMs - startTimeMs);
  const body = {
    aggregateBy: [{ dataTypeName: dataType }],
    bucketByTime: { durationMillis: effectiveBucket },
    startTimeMillis: startTimeMs,
    endTimeMillis: endTimeMs,
  };

  const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Log status and headers for debugging
  try {
    console.log(`Google Fit aggregate API response status: ${response.status} ${response.statusText}`);
    const headersObj = {};
    response.headers.forEach((v, k) => { headersObj[k] = v; });
    console.log(`Google Fit aggregate API response headers:`, headersObj);
  } catch (hdrErr) {
    console.log('Failed to read response headers', hdrErr);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Aggregate API error for ${dataTypeKey}:`, errorText);
    throw new Error(`Aggregate API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Log the full JSON response for debugging (trim if very large)
  try {
    console.log(`Aggregate response for ${dataTypeKey}:`, JSON.stringify(data, null, 2));
  } catch (logErr) {
    console.log('Could not stringify aggregate response', logErr);
  }

  // Flatten all data points from all buckets into a single { point: [...] } shape
  // so parseGoogleFitData can work unchanged
  const allPoints = [];
  for (const bucket of (data.bucket || [])) {
    for (const dataset of (bucket.dataset || [])) {
      for (const point of (dataset.point || [])) {
        allPoints.push(point);
      }
    }
  }

  console.log(`Total data points for ${dataTypeKey}: ${allPoints.length}`);
  return { point: allPoints };
};

/**
 * Fetch session data from Google Fit
 */
export const fetchGoogleFitSession = async (accessToken, sessionId) => {
  const sessionEndpoint = `https://www.googleapis.com/fitness/v1/users/me/sessions/${sessionId}`;

  try {
    const response = await fetch(sessionEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    console.log(`Google Fit session API response status: ${response.status} ${response.statusText}`);
    const headersObj = {};
    try { response.headers.forEach((v, k) => { headersObj[k] = v; }); } catch (e) {}
    console.log('Google Fit session API response headers:', headersObj);

    const text = await response.text();
    // Try to parse JSON, but log raw text for debugging
    try {
      const json = JSON.parse(text);
      if (!response.ok) {
        console.error('Session fetch returned error body:', JSON.stringify(json, null, 2));
        throw new Error(`Session fetch failed: ${response.status} ${response.statusText}`);
      }
      console.log('Session fetch response body:', JSON.stringify(json, null, 2));
      return json;
    } catch (parseErr) {
      // Not JSON
      console.error('Session fetch returned non-JSON body:', text);
      if (!response.ok) throw new Error(`Session fetch failed: ${response.status} ${response.statusText}`);
      return text;
    }
  } catch (error) {
    console.error('Error fetching session:', error);
    throw error;
  }
};

/**
 * Parse Google Fit data into our format
 */
export const parseGoogleFitData = (rawData, dataType) => {
  const parsedData = [];

  // Handle data sources API response format (point array)
  rawData.point?.forEach(point => {
    const timestamp = new Date(parseInt(point.startTimeNanos) / 1000000);

    let value = null;
    if (point.value && point.value.length > 0) {
      // Different data types store values differently
      if (point.value[0].intVal !== undefined) {
        value = point.value[0].intVal;
      } else if (point.value[0].fpVal !== undefined) {
        value = point.value[0].fpVal;
      }
    }

    if (value !== null) {
      parsedData.push({
        timestamp,
        value,
        dataType
      });
    }
  });

  return parsedData;
};

export { DATA_TYPES };
