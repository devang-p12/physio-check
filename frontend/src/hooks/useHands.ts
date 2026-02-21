import { useEffect, useRef, type RefObject } from "react"
import { Hands, type Results as HandResults } from "@mediapipe/hands"
import { Camera } from "@mediapipe/camera_utils"
import { processHandPose, resetHandState } from "../utils/poseLogic"

interface Props {
  videoRef: RefObject<HTMLVideoElement>
  canvasRef: RefObject<HTMLCanvasElement>
  isActive: boolean
  tolerances?: { joint: string; tolerance: number }[]
  exerciseName?: string
  onRepUpdate: (reps: number) => void
  onPostureUpdate: (status: "correct" | "incorrect") => void
  onCueUpdate?: (cue: string | null) => void
}

/* ── TTS helper ───────────────────────────────────────────────────────── */
function speak(text: string) {
  if (!("speechSynthesis" in window)) return
  // cancel any current utterance so the new one plays immediately
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 0.95
  utt.pitch = 1.0
  utt.volume = 1.0
  window.speechSynthesis.speak(utt)
}

export function useHands({
  videoRef,
  canvasRef,
  isActive,
  tolerances = [],
  exerciseName,
  onRepUpdate,
  onPostureUpdate,
  onCueUpdate,
}: Props) {
  // Track last spoken cue + timestamp to avoid spamming
  const lastCueRef = useRef<string | null>(null)
  const lastSpokenRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!

    resetHandState()
    lastCueRef.current = null
    lastSpokenRef.current = 0

    const hands = new Hands({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    })

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    hands.onResults((results: HandResults) => {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return

      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Use the first detected hand (most visible), but recognize both
      const { reps, posture, cue } = processHandPose(
        results.multiHandLandmarks,
        tolerances,
        exerciseName
      )

      onRepUpdate(reps)
      onPostureUpdate(posture)
      onCueUpdate?.(cue)

      // ── TTS: speak cue when it changes, max once every 4 s ──
      const now = Date.now()
      if (
        cue !== null &&
        (cue !== lastCueRef.current || now - lastSpokenRef.current > 8000) &&
        now - lastSpokenRef.current > 4000
      ) {
        speak(cue)
        lastCueRef.current = cue
        lastSpokenRef.current = now
      } else if (cue === null) {
        lastCueRef.current = null
      }

      drawHandSkeleton(ctx, results.multiHandLandmarks)
    })

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video })
      },
      width: 640,
      height: 480
    })

    camera.start()

    return () => {
      camera.stop()
      window.speechSynthesis?.cancel()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [isActive])
}

/* ---------- Hand Skeleton Drawing ---------- */
function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  allHandLandmarks: any[][]
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height

  // Draw each detected hand with different colors
  const colors = ["#FF6B9D", "#00D9FF"];

  allHandLandmarks.forEach((landmarks, handIndex) => {
    ctx.strokeStyle = colors[handIndex % colors.length]
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.fillStyle = colors[handIndex % colors.length]

    // Helper to draw line
    const line = (a: number, b: number) => {
      ctx.beginPath()
      ctx.moveTo(landmarks[a].x * W, landmarks[a].y * H)
      ctx.lineTo(landmarks[b].x * W, landmarks[b].y * H)
      ctx.stroke()
    }

    // Helper to draw joint
    const joint = (i: number) => {
      ctx.beginPath()
      ctx.arc(landmarks[i].x * W, landmarks[i].y * H, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw hand skeleton (MediaPipe Hand has 21 landmarks)
    // Palm
    line(0, 1)
    line(1, 2)
    line(2, 3)
    line(3, 4) // Thumb

    line(0, 5)
    line(5, 6)
    line(6, 7)
    line(7, 8) // Index

    line(0, 9)
    line(9, 10)
    line(10, 11)
    line(11, 12) // Middle

    line(0, 13)
    line(13, 14)
    line(14, 15)
    line(15, 16) // Ring

    line(0, 17)
    line(17, 18)
    line(18, 19)
    line(19, 20) // Pinky

    // Draw all joints
    for (let i = 0; i < 21; i++) {
      joint(i)
    }
  });
}
