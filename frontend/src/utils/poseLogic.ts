import type { Landmark } from "@/types/pose"

let reps = 0
let state: "UP" | "DOWN" = "UP"

export function resetPoseState() {
  reps = 0
  state = "UP"
}

// tolerance: 0–30 degrees added by doctor to widen thresholds for injured patients
export function processPose(landmarks: Landmark[], tolerance: number = 0) {
  const clampedTolerance = Math.max(0, Math.min(30, tolerance))

  // Use whichever side has higher visibility (default left)
  const useRight =
    (landmarks[24]?.visibility ?? 0) > (landmarks[23]?.visibility ?? 0)

  const shoulder = useRight ? landmarks[12] : landmarks[11]
  const hip      = useRight ? landmarks[24] : landmarks[23]
  const knee     = useRight ? landmarks[26] : landmarks[25]
  const ankle    = useRight ? landmarks[28] : landmarks[27]
  const nose     = landmarks[0]

  const kneeAngle = calculateAngle(hip, knee, ankle)

  const downThreshold = 90 + clampedTolerance
  const upThreshold   = 160 - clampedTolerance

  if (kneeAngle < downThreshold && state === "UP")  state = "DOWN"
  if (kneeAngle > upThreshold   && state === "DOWN") { reps++; state = "UP" }

  // ── Form checks ──────────────────────────────────────────────
  const cue = detectFormCue(shoulder, hip, knee, ankle, nose, state, kneeAngle)

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
