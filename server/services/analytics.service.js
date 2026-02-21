/**
 * Analytics Service for Session Data
 * Processes sensor data and generates insights
 */

/**
 * Calculate heart rate zones based on age
 * Zones: Low (50-60%), Moderate (60-70%), High (70-85%), Peak (85-100%)
 */
const calculateHeartRateZones = (age) => {
  const maxHeartRate = 220 - age;
  return {
    low: { min: maxHeartRate * 0.5, max: maxHeartRate * 0.6 },
    moderate: { min: maxHeartRate * 0.6, max: maxHeartRate * 0.7 },
    high: { min: maxHeartRate * 0.7, max: maxHeartRate * 0.85 },
    peak: { min: maxHeartRate * 0.85, max: maxHeartRate * 1.0 }
  };
};

/**
 * Analyze heart rate data
 */
export const analyzeHeartRate = (sensorData, patientAge = 30) => {
  const heartRates = sensorData
    .filter(d => d.heartRate)
    .map(d => d.heartRate);

  if (heartRates.length === 0) {
    return null;
  }

  const avgHeartRate = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
  const maxHeartRate = Math.max(...heartRates);
  const minHeartRate = Math.min(...heartRates);

  // Calculate time in each zone
  const zones = calculateHeartRateZones(patientAge);
  const intensityZones = {
    low: 0,
    moderate: 0,
    high: 0,
    peak: 0
  };

  heartRates.forEach(hr => {
    if (hr >= zones.low.min && hr < zones.low.max) {
      intensityZones.low++;
    } else if (hr >= zones.moderate.min && hr < zones.moderate.max) {
      intensityZones.moderate++;
    } else if (hr >= zones.high.min && hr < zones.high.max) {
      intensityZones.high++;
    } else if (hr >= zones.peak.min) {
      intensityZones.peak++;
    }
  });

  return {
    avgHeartRate: Math.round(avgHeartRate),
    maxHeartRate,
    minHeartRate,
    intensityZones
  };
};

/**
 * Calculate total movement metrics
 */
export const analyzeMovement = (sensorData) => {
  let totalSteps = 0;
  let totalDistance = 0;
  let totalCalories = 0;

  sensorData.forEach(data => {
    if (data.steps) totalSteps += data.steps;
    if (data.distance) totalDistance += data.distance;
    if (data.calories) totalCalories += data.calories;
  });

  return {
    totalSteps,
    totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimals
    totalCalories: Math.round(totalCalories * 100) / 100
  };
};

/**
 * Analyze form quality based on acceleration and gyroscope data
 */
export const analyzeFormQuality = (sensorData) => {
  const dataWithMotion = sensorData.filter(
    d => d.acceleration || d.gyroscope
  );

  if (dataWithMotion.length === 0) {
    return {
      score: null,
      issues: []
    };
  }

  let score = 100;
  const issues = [];

  // Analyze acceleration patterns
  const accelerations = dataWithMotion
    .filter(d => d.acceleration)
    .map(d => {
      const { x, y, z } = d.acceleration;
      return Math.sqrt(x * x + y * y + z * z);
    });

  if (accelerations.length > 0) {
    // Calculate variance
    const mean = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    const variance = accelerations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / accelerations.length;
    const stdDev = Math.sqrt(variance);

    // High variance indicates inconsistent movement
    if (stdDev > 5) {
      score -= 15;
      issues.push('Inconsistent movement pattern detected');
    }

    // Check for sudden jerks (high acceleration)
    const maxAcceleration = Math.max(...accelerations);
    if (maxAcceleration > 20) {
      score -= 10;
      issues.push('Sudden jerky movements detected');
    }
  }

  // Analyze gyroscope (rotation) patterns
  const gyroscopes = dataWithMotion
    .filter(d => d.gyroscope)
    .map(d => {
      const { x, y, z } = d.gyroscope;
      return Math.sqrt(x * x + y * y + z * z);
    });

  if (gyroscopes.length > 0) {
    const maxRotation = Math.max(...gyroscopes);
    
    // Excessive rotation might indicate poor form
    if (maxRotation > 180) {
      score -= 15;
      issues.push('Excessive body rotation detected');
    }
  }

  // Analyze orientation (posture)
  const orientations = dataWithMotion.filter(d => d.orientation);
  if (orientations.length > 0) {
    const pitchAngles = orientations.map(d => Math.abs(d.orientation.pitch));
    const avgPitch = pitchAngles.reduce((a, b) => a + b, 0) / pitchAngles.length;

    // Poor posture (leaning forward/backward)
    if (avgPitch > 30) {
      score -= 20;
      issues.push('Poor posture: excessive forward/backward lean');
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues
  };
};

/**
 * Count reps from acceleration data
 * Uses peak detection algorithm
 */
export const countRepsFromSensorData = (sensorData) => {
  const accelerations = sensorData
    .filter(d => d.acceleration)
    .map(d => {
      const { x, y, z } = d.acceleration;
      return {
        timestamp: d.timestamp,
        magnitude: Math.sqrt(x * x + y * y + z * z)
      };
    });

  if (accelerations.length < 10) {
    return 0;
  }

  // Simple peak detection
  let reps = 0;
  const threshold = 2.0; // Threshold for detecting a rep
  let isPeak = false;

  for (let i = 1; i < accelerations.length - 1; i++) {
    const prev = accelerations[i - 1].magnitude;
    const curr = accelerations[i].magnitude;
    const next = accelerations[i + 1].magnitude;

    // Detect peak
    if (curr > prev && curr > next && curr > threshold) {
      if (!isPeak) {
        reps++;
        isPeak = true;
      }
    } else if (curr < threshold) {
      isPeak = false;
    }
  }

  return reps;
};

/**
 * Generate comprehensive analytics for a session
 */
export const generateSessionAnalytics = (session, patientAge = 30) => {
  const { sensorData, startTime, endTime } = session;

  if (!sensorData || sensorData.length === 0) {
    return {
      error: 'No sensor data available for analysis'
    };
  }

  // Calculate total duration
  const duration = endTime 
    ? (new Date(endTime) - new Date(startTime)) / 1000 
    : (Date.now() - new Date(startTime)) / 1000;

  // Analyze different aspects
  const heartRateAnalysis = analyzeHeartRate(sensorData, patientAge);
  const movementAnalysis = analyzeMovement(sensorData);
  const formAnalysis = analyzeFormQuality(sensorData);
  const repsCompleted = countRepsFromSensorData(sensorData);

  return {
    totalDuration: Math.round(duration),
    ...heartRateAnalysis,
    ...movementAnalysis,
    formQuality: formAnalysis,
    repsCompleted,
    setsCompleted: Math.floor(repsCompleted / 10), // Assuming 10 reps per set
    dataPointsCollected: sensorData.length,
    averageDataRate: Math.round(sensorData.length / duration * 100) / 100 // points per second
  };
};

/**
 * Compare session performance with previous sessions
 */
export const compareSessionPerformance = (currentSession, previousSessions) => {
  if (!previousSessions || previousSessions.length === 0) {
    return {
      message: 'No previous sessions to compare',
      isFirstSession: true
    };
  }

  const current = currentSession.analytics;
  const previous = previousSessions[0].analytics; // Most recent previous session

  const improvements = [];
  const declines = [];

  // Compare heart rate
  if (current.avgHeartRate && previous.avgHeartRate) {
    const hrDiff = current.avgHeartRate - previous.avgHeartRate;
    if (Math.abs(hrDiff) > 5) {
      if (hrDiff < 0) {
        improvements.push(`Heart rate improved by ${Math.abs(hrDiff)} bpm`);
      } else {
        declines.push(`Heart rate increased by ${hrDiff} bpm`);
      }
    }
  }

  // Compare reps
  if (current.repsCompleted && previous.repsCompleted) {
    const repDiff = current.repsCompleted - previous.repsCompleted;
    if (repDiff > 0) {
      improvements.push(`Completed ${repDiff} more reps`);
    } else if (repDiff < 0) {
      declines.push(`Completed ${Math.abs(repDiff)} fewer reps`);
    }
  }

  // Compare form quality
  if (current.formQuality?.score && previous.formQuality?.score) {
    const formDiff = current.formQuality.score - previous.formQuality.score;
    if (formDiff > 5) {
      improvements.push(`Form quality improved by ${formDiff} points`);
    } else if (formDiff < -5) {
      declines.push(`Form quality declined by ${Math.abs(formDiff)} points`);
    }
  }

  return {
    improvements,
    declines,
    overallTrend: improvements.length > declines.length ? 'improving' : 
                  declines.length > improvements.length ? 'declining' : 'stable'
  };
};

/**
 * Generate insights and recommendations
 */
export const generateInsights = (analytics, comparison) => {
  const insights = [];
  const recommendations = [];

  // Heart rate insights
  if (analytics.avgHeartRate) {
    if (analytics.avgHeartRate > 160) {
      insights.push('High intensity workout detected');
      recommendations.push('Consider taking more breaks to manage heart rate');
    } else if (analytics.avgHeartRate < 100) {
      insights.push('Low intensity workout');
      recommendations.push('Try to increase exercise intensity gradually');
    }
  }

  // Form quality insights
  if (analytics.formQuality?.score) {
    if (analytics.formQuality.score < 60) {
      insights.push('Poor form detected during exercise');
      recommendations.push('Focus on proper posture and controlled movements');
    } else if (analytics.formQuality.score > 85) {
      insights.push('Excellent form maintained throughout session');
    }
  }

  // Progress insights
  if (comparison?.overallTrend === 'improving') {
    insights.push('Great progress! You\'re improving consistently');
  } else if (comparison?.overallTrend === 'declining') {
    insights.push('Performance has declined recently');
    recommendations.push('Consider reviewing your technique with your physiotherapist');
  }

  // Intensity zone insights
  if (analytics.intensityZones) {
    const total = Object.values(analytics.intensityZones).reduce((a, b) => a + b, 0);
    const peakPercent = (analytics.intensityZones.peak / total) * 100;
    
    if (peakPercent > 30) {
      insights.push('High peak intensity zone time');
      recommendations.push('Ensure adequate rest between sets');
    }
  }

  return {
    insights,
    recommendations
  };
};
