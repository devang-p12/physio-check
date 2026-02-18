import type { Landmark } from "@/types/pose"

let reps = 0
let state: "UP" | "DOWN" = "UP"

export function resetPoseState() {
  reps = 0
  state = "UP"
}

export function processPose(landmarks: Landmark[]) {
  const hip = landmarks[23]
  const knee = landmarks[25]
  const ankle = landmarks[27]

  const angle = calculateAngle(hip, knee, ankle)

  // Rep logic
  if (angle < 90 && state === "UP") {
    state = "DOWN"
  }

  if (angle > 160 && state === "DOWN") {
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