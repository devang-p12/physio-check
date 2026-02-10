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

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
};

/**
 * Fetch fitness data from Google Fit
 */
export const fetchFitnessData = async (accessToken, dataTypeKey, startTime, endTime) => {
  const dataType = DATA_TYPES[dataTypeKey];

  console.log(`Fetching ${dataTypeKey} (${dataType}) from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

  try {
    // First, get all available data sources
    const sourcesResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!sourcesResponse.ok) {
      throw new Error(`Failed to get data sources: ${sourcesResponse.statusText}`);
    }

    const sourcesData = await sourcesResponse.json();
    console.log(`Found ${sourcesData.dataSource?.length || 0} total data sources`);

    // Find data sources that match our data type
    const matchingSources = sourcesData.dataSource?.filter(ds =>
      ds.dataType?.name === dataType
    ) || [];

    console.log(`Found ${matchingSources.length} sources matching ${dataType}:`,
      matchingSources.map(ds => ({ id: ds.dataStreamId, name: ds.dataType?.name })));

    if (matchingSources.length === 0) {
      console.log(`No data sources found for ${dataType}, returning empty data`);
      return { point: [] };
    }

    // Try to fetch data from the first matching source
    const dataSource = matchingSources[0];
    const dataEndpoint = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${dataSource.dataStreamId}/datasets/${startTime}000000-${endTime}000000`;

    console.log(`Fetching from data source: ${dataSource.dataStreamId}`);

    const response = await fetch(dataEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    console.log(`Response status for ${dataTypeKey}:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error response for ${dataTypeKey}:`, errorText);
      throw new Error(`Fitness data fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Raw API response for ${dataTypeKey}:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error(`Error fetching ${dataTypeKey}:`, error);
    throw error;
  }
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

    if (!response.ok) {
      throw new Error(`Session fetch failed: ${response.statusText}`);
    }

    return await response.json();
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
