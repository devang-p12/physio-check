import type { Landmark } from "@/types/pose"

let reps = 0
let state: "UP" | "DOWN" = "UP"

// Hand tracking state
let handReps = 0
let handState: "OPEN" | "CLOSED" = "OPEN"

// Calves tracking state
let calvesLastShoulderY: number | null = null;
let calvesMovementDirection: "NONE" | "UP" | "DOWN" = "NONE";
let calvesMovementAccumulator = 0;

export function resetPoseState() {
  reps = 0
  state = "UP"
  calvesLastShoulderY = null;
  calvesMovementDirection = "NONE";
  calvesMovementAccumulator = 0;
}

export function resetHandState() {
  handReps = 0
  handState = "OPEN"
}

export function processPose(
  landmarks: Landmark[],
  tolerances: { joint: string; tolerance: number }[] = [],
  exerciseName: string = "Squat"
) {
  // Map tolerances by joint name for easy lookup (clamp max to 90 degrees for safety)
  const tMap = Object.fromEntries(
    tolerances.map(t => [t.joint.toLowerCase(), Math.max(0, Math.min(90, t.tolerance))])
  );
  const kneeTol = tMap['knee'] ?? 0;
  const hipTol = tMap['hip'] ?? 0;
  const shoulderTol = tMap['shoulder'] ?? 0;
  const elbowTol = tMap['elbow'] ?? 0;

  // Use whichever side has higher visibility (default left)
  const useRight =
    (landmarks[24]?.visibility ?? 0) > (landmarks[23]?.visibility ?? 0)

  const shoulder = useRight ? landmarks[12] : landmarks[11]
  const hip = useRight ? landmarks[24] : landmarks[23]
  const knee = useRight ? landmarks[26] : landmarks[25]
  const ankle = useRight ? landmarks[28] : landmarks[27]
  const wrist = useRight ? landmarks[16] : landmarks[15]
  const elbow = useRight ? landmarks[14] : landmarks[13]
  const nose = landmarks[0]

  const exerciseLower = exerciseName.toLowerCase();
  let cue: string | null = null;

  // Multiple motion handling
  if (exerciseLower.includes("bicep") || exerciseLower.includes("curl")) {
    // Bicep Curl tracking
    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    if (elbowAngle < 45 + elbowTol && state === "UP") state = "DOWN";
    if (elbowAngle > 150 - elbowTol && state === "DOWN") { reps++; state = "UP"; }

    // basic form check for curl
    const shoulderElbowAngle = calculateAngle(hip, shoulder, elbow);
    if (shoulderElbowAngle > 30 + shoulderTol) {
      cue = "Keep elbows tucked to your sides";
    }
  } else if (exerciseLower.includes("calves") || exerciseLower.includes("calf")) {
    // Calves Up Down tracking — detect relative vertical skeleton movement
    // Track if skeleton moved UP (negative displacement) or DOWN (positive displacement)
    const currentShoulderY = shoulder.y;
    
    // Only start tracking after we have a previous position
    if (calvesLastShoulderY !== null) {
      const frameDisplacement = calvesLastShoulderY - currentShoulderY; // Negative = up, Positive = down
      
      // Accumulate small movements to detect sustained direction
      if (frameDisplacement < -0.008) {
        // Moving UP (skeleton rising as heels lift)
        calvesMovementDirection = "UP";
        calvesMovementAccumulator -= frameDisplacement; // Accumulate upward movement
      } else if (frameDisplacement > 0.008) {
        // Moving DOWN (skeleton lowering as heels return)
        calvesMovementDirection = "DOWN";
        calvesMovementAccumulator += frameDisplacement; // Accumulate downward movement
      }
      
      // Detect complete UP phase (accumulated enough upward movement)
      if (calvesMovementDirection === "UP" && calvesMovementAccumulator > 0.04 && state === "UP") {
        state = "DOWN";
        calvesMovementAccumulator = 0;
      }
      
      // Detect complete DOWN phase (accumulated enough downward movement) — count rep
      if (calvesMovementDirection === "DOWN" && calvesMovementAccumulator > 0.04 && state === "DOWN") {
        reps++;
        state = "UP";
        calvesMovementAccumulator = 0;
      }
    }
    
    // Always update last position for next frame
    calvesLastShoulderY = currentShoulderY;

    // Form checks for calves
    cue = detectCalvesFormCue(shoulder, hip, ankle, state);
  } else {
    // Squat (Default) tracking
    const kneeAngle = calculateAngle(hip, knee, ankle);
    const downThreshold = 90 + kneeTol;
    const upThreshold = 160 - kneeTol;

    if (kneeAngle < downThreshold && state === "UP") state = "DOWN";
    if (kneeAngle > upThreshold && state === "DOWN") { reps++; state = "UP"; }

    // ── Form checks ──────────────────────────────────────────────
    cue = detectFormCue(shoulder, hip, knee, ankle, nose, state, kneeAngle);
  }

  const posture: "correct" | "incorrect" = cue === null ? "correct" : "incorrect"

  return { reps, posture, cue }
}

function detectFormCue(
  shoulder: Landmark,
  hip: Landmark,
  knee: Landmark,
  ankle: Landmark,
  nose: Landmark,
  squatState: "UP" | "DOWN",
  kneeAngle: number
): string | null {
  // 1. BACK LEAN — torso vector angle from vertical (x displacement relative to height)
  //    MediaPipe x/y are normalised 0-1, y increases downward.
  //    In a standing pose shoulder should be directly above hip.
  //    dx/dy > ~0.35 means leaning markedly forward.
  const torsoLeanRatio = Math.abs(shoulder.x - hip.x) / Math.max(Math.abs(shoulder.y - hip.y), 0.001)
  if (torsoLeanRatio > 0.35) {
    return "Keep your back straight"
  }

  // 2. KNEES CAVING IN — knee x deviates significantly inward from ankle x
  //    For left side: knee.x > ankle.x means knee drifting right (inward).
  //    For right side we invert: knee.x < ankle.x.
  //    We check both by using absolute lateral deviation normalised by leg height.
  const legHeight = Math.abs(knee.y - ankle.y)
  const kneeDeviation = (knee.x - ankle.x) / Math.max(legHeight, 0.001)
  if (Math.abs(kneeDeviation) > 0.4) {
    return "Keep your knees over your toes"
  }

  // 3. NOT GOING DEEP ENOUGH — only flag mid-squat when angle is >110° (not going low enough)
  if (squatState === "DOWN" && kneeAngle > 110) {
    return "Go lower — aim for parallel"
  }

  // 4. HEAD DOWN — nose below hips means the person is severely bent/collapsed
  if (nose.y > hip.y + 0.05) {
    return "Chest up — look straight ahead"
  }

  // 5. KNEES TOO FAR FORWARD — knee x past ankle x by a lot (horizontal, front cam)
  const kneeForward = (knee.x - ankle.x) / Math.max(legHeight, 0.001)
  if (kneeForward > 0.55) {
    return "Don't let knees go past your toes"
  }

  return null
}

function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }

  const dot = ab.x * cb.x + ab.y * cb.y
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)

  if (mag === 0) return 180
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

function detectCalvesFormCue(
  shoulder: Landmark,
  hip: Landmark,
  ankle: Landmark,
  calvesState: "UP" | "DOWN"
): string | null {
  // 1. TORSO ALIGNMENT — keep straight posture during calf raises
  const torsoLeanRatio = Math.abs(shoulder.x - hip.x) / Math.max(Math.abs(shoulder.y - hip.y), 0.001)
  if (torsoLeanRatio > 0.35) {
    return "Keep your body upright"
  }

  // 2. ANKLES CAVING IN — both ankles should stay inline
  if (Math.abs(ankle.x - hip.x) > 0.25) {
    return "Keep your weight centered"
  }

  return null
}

/* ────────────────────── HAND TRACKING ────────────────────── */

export interface HandLandmark {
  x: number
  y: number
  z: number
}

export function processHandPose(
  handLandmarks: any[] | any[][],
  tolerances: { joint: string; tolerance: number }[] = [],
  exerciseName: string = "Palm Open Close"
): { reps: number; posture: "correct" | "incorrect"; cue: string | null } {
  const exerciseLower = exerciseName.toLowerCase();
  let cue: string | null = null;

  // Handle both single hand (array of landmarks) and multiple hands (array of arrays)
  const allHands = Array.isArray(handLandmarks[0]) ? handLandmarks : [handLandmarks];
  
  // Use the first hand for rep counting (most visible/primary hand)
  const primaryHand = allHands[0];

  if (exerciseLower.includes("palm") && exerciseLower.includes("open")) {
    // Palm Open Close tracking — count reps from primary hand only
    const openness = calculateHandOpenness(primaryHand);
    
    // More lenient thresholds for better rep counting
    const openThreshold = 0.55;   // Hand is considered "open" above this
    const closedThreshold = 0.35; // Hand is considered "closed" below this

    // Hysteresis: need clear separation between states
    if (openness > openThreshold && handState === "CLOSED") {
      handState = "OPEN";
      handReps++;
    } else if (openness < closedThreshold && handState === "OPEN") {
      handState = "CLOSED";
    }

    // Form check: ensure hand is visible and stable
    if (calculateHandStability(primaryHand) < 0.4) {
      cue = "Position your hand clearly in view";
    }
  }

  const posture: "correct" | "incorrect" = cue === null ? "correct" : "incorrect";
  return { reps: handReps, posture, cue };
}

function calculateHandOpenness(landmarks: any[]): number {
  // MediaPipe hand landmarks (21 total):
  // 0: Wrist/Palm base
  // 4, 8, 12, 16, 20: Thumb, Index, Middle, Ring, Pinky tips
  // 1-3: Thumb intermediate
  // 5-7: Index intermediate
  // 9-11: Middle intermediate
  // 13-15: Ring intermediate
  // 17-19: Pinky intermediate

  if (landmarks.length < 21) return 0;

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  // Calculate distance from wrist to each fingertip
  const distThumb = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
  const distIndex = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
  const distMiddle = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
  const distRing = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y);
  const distPinky = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);

  // Average distance — increases when hand opens, decreases when closed
  const avgDistance = (distThumb + distIndex + distMiddle + distRing + distPinky) / 5;

  // Calculate finger spread — angle between adjacent fingers
  // When fingers are together (closed), angles are small. When spread (open), angles are large.
  const thumbIndexSpread = calculateHandAngle(thumbTip, wrist, indexTip);
  const indexMiddleSpread = calculateHandAngle(indexTip, wrist, middleTip);
  const middleRingSpread = calculateHandAngle(middleTip, wrist, ringTip);
  const ringPinkySpread = calculateHandAngle(ringTip, wrist, pinkyTip);

  const avgSpread = (thumbIndexSpread + indexMiddleSpread + middleRingSpread + ringPinkySpread) / 4;

  // Normalize metrics to 0-1 range
  // Distance: typical closed hand ~0.15, fully open ~0.35-0.4
  const normalizedDistance = Math.min(1, Math.max(0, (avgDistance - 0.1) / 0.3));

  // Spread angle: closed ~15-25 degrees, open ~40-60 degrees
  const normalizedSpread = Math.min(1, Math.max(0, (avgSpread - 15) / 45));

  // Combine with more weight on distance (more reliable indicator)
  const openness = (normalizedDistance * 0.7 + normalizedSpread * 0.3);

  return Math.min(1, Math.max(0, openness));
}

function calculateHandStability(landmarks: any[]): number {
  // Check if all key landmarks are visible and tracked
  if (landmarks.length < 21) return 0;

  const keyPoints = [0, 4, 8, 12, 16, 20]; // Wrist, all 5 fingertips
  let visibleCount = 0;
  let zVariance = 0;

  for (const idx of keyPoints) {
    if (landmarks[idx] && landmarks[idx].z !== undefined) {
      visibleCount++;
      zVariance += Math.abs(landmarks[idx].z || 0);
    }
  }

  // Stability is good if most key points are visible
  const visibility = visibleCount / keyPoints.length;

  // Also check z-depth variance — stable hand has consistent depth
  const avgZ = zVariance / Math.max(visibleCount, 1);
  const depthStability = Math.min(1, 1 - avgZ); // Lower z variance = higher stability

  return visibility * 0.7 + depthStability * 0.3;
}

function calculateHandAngle(a: any, b: any, c: any): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };

  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);

  if (mag === 0) return 0;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
  return angle;
}
