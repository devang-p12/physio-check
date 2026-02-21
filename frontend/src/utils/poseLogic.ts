import type { Landmark } from "@/types/pose"

let reps = 0
let state: "UP" | "DOWN" = "UP"

export function resetPoseState() {
  reps = 0
  state = "UP"
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
