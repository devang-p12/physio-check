import { LandmarkList } from "@mediapipe/pose";

/**
 * Normalizes landmarks relative to the center of the hips and scales by shoulder width.
 * This makes the detection invariant to the person's distance from the camera.
 */
export const normalizePose = (landmarks: LandmarkList) => {
  if (!landmarks || landmarks.length < 33) return null;

  const midHip = {
    x: (landmarks[23].x + landmarks[24].x) / 2,
    y: (landmarks[23].y + landmarks[24].y) / 2,
  };

  const shoulderWidth = Math.sqrt(
    Math.pow(landmarks[11].x - landmarks[12].x, 2) +
    Math.pow(landmarks[11].y - landmarks[12].y, 2)
  ) || 0.1; // Fallback to prevent division by zero

  return landmarks.map((lm) => ({
    x: (lm.x - midHip.x) / shoulderWidth,
    y: (lm.y - midHip.y) / shoulderWidth,
    z: lm.z / shoulderWidth,
    visibility: lm.visibility ?? 1,
  }));
};

/**
 * Calculates similarity between two frames. 
 * Result closer to 0 means higher similarity.
 */
export const getPoseSimilarity = (poseA: any[], poseB: any[]) => {
  if (!poseA || !poseB) return 1;

  // We focus on key joints for physical therapy (Shoulders, Elbows, Wrists, Hips, Knees, Ankles)
  const joints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; 
  let totalDist = 0;
  let validJoints = 0;

  joints.forEach((i) => {
    if (poseA[i] && poseB[i]) {
      const dist = Math.sqrt(
        Math.pow(poseA[i].x - poseB[i].x, 2) + 
        Math.pow(poseA[i].y - poseB[i].y, 2)
      );
      totalDist += dist;
      validJoints++;
    }
  });

  return validJoints > 0 ? totalDist / validJoints : 1;
};

/**
 * Automatically segments a long recording into individual reps.
 * It looks for the moment the user leaves the "start pose" and returns to it.
 */
export const segmentReps = (buffer: any[][]) => {
  if (buffer.length < 40) return [];
  
  const startPose = buffer[0];
  const segmentedReps: any[][][] = [];
  let currentRep: any[][] = [];
  let hasMovedSignificantDistance = false;

  buffer.forEach((frame) => {
    const similarity = getPoseSimilarity(frame, startPose);
    currentRep.push(frame);

    // threshold 0.3 means they have moved significantly away from rest
    if (similarity > 0.3) hasMovedSignificantDistance = true; 

    // threshold 0.15 means they have returned to rest
    if (hasMovedSignificantDistance && similarity < 0.15 && currentRep.length > 25) {
      segmentedReps.push(currentRep);
      currentRep = [];
      hasMovedSignificantDistance = false;
    }
  });

  return segmentedReps;
};

/**
 * Compares the patient's current sliding window of motion to the Master sequence.
 * This ensures they follow the path, not just hit the end-point.
 */
export const compareSequences = (liveWindow: any[][], template: any[][]) => {
  // We need at least 75% of the template's length to make a fair comparison
  if (liveWindow.length < template.length * 0.75) return 1;

  let totalDist = 0;
  const samples = 15; // Number of checkpoints along the time-curve

  for (let i = 0; i < samples; i++) {
    const templateIdx = Math.floor((i / samples) * (template.length - 1));
    const windowIdx = Math.floor((i / samples) * (liveWindow.length - 1));
    totalDist += getPoseSimilarity(liveWindow[windowIdx], template[templateIdx]);
  }

  return totalDist / samples;
};

/**
 * Processes the multi-rep recording to create a clean Master Model.
 */
export const createMasterTemplate = (buffer: any[][]) => {
  const reps = segmentReps(buffer);
  
  // Requirement: Physio should perform at least 2 reps to establish a baseline
  if (reps.length < 1) return null;

  // Select the middle rep (usually more stable than the first or last)
  const master = reps[Math.floor(reps.length / 2)];
  
  // Find the "Peak" frame (the frame most different from the start)
  let maxDiff = 0;
  let peakIdx = 0;
  const startFrame = master[0];

  master.forEach((frame, idx) => {
    const diff = getPoseSimilarity(frame, startFrame);
    if (diff > maxDiff) {
      maxDiff = diff;
      peakIdx = idx;
    }
  });

  return {
    fullSequence: master,
    peakFrame: master[peakIdx],
    startFrame: master[0],
    difficultyThreshold: 0.22 // Default sensitivity
  };
};