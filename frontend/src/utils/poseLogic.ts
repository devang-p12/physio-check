import type { Landmark } from "@/types/pose"

let reps = 0
let state: "UP" | "DOWN" = "UP"

export function resetPoseState() {
  reps = 0
  state = "UP"
}

// tolerance: 0–30 degrees added by doctor to widen thresholds for injured patients
// e.g. tolerance=20 → DOWN triggers at <110° instead of <90°, UP triggers at >140° instead of >160°
export function processPose(landmarks: Landmark[], tolerance: number = 0) {
  const clampedTolerance = Math.max(0, Math.min(30, tolerance))

  const hip = landmarks[23]
  const knee = landmarks[25]
  const ankle = landmarks[27]

  const angle = calculateAngle(hip, knee, ankle)

  const downThreshold = 90 + clampedTolerance
  const upThreshold = 160 - clampedTolerance

  // Rep logic — thresholds widened by tolerance for recovering patients
  if (angle < downThreshold && state === "UP") {
    state = "DOWN"
  }

  if (angle > upThreshold && state === "DOWN") {
    reps++
    state = "UP"
  }

  // Simple posture logic (placeholder)
  const posture: "correct" | "incorrect" =
    hip.x < knee.x ? "incorrect" : "correct"

  return { reps, posture }
}

function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }

  const dot = ab.x * cb.x + ab.y * cb.y
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)

  return (Math.acos(dot / mag) * 180) / Math.PI
}
