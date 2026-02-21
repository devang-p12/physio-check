import { useEffect, useRef, RefObject } from "react"
import { Pose, Results } from "@mediapipe/pose"
import { Camera } from "@mediapipe/camera_utils"
import { processPose, resetPoseState } from "@/utils/poseLogic"

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

export function usePose({
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

    resetPoseState()
    lastCueRef.current = null
    lastSpokenRef.current = 0

    const pose = new Pose({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    })

    pose.onResults((results: Results) => {
      if (!results.poseLandmarks) return

      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { reps, posture, cue } = processPose(results.poseLandmarks, tolerances, exerciseName)

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

      drawSkeleton(ctx, results.poseLandmarks)
    })

    const camera = new Camera(video, {
      onFrame: async () => {
        await pose.send({ image: video })
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

/* ---------- Skeleton Drawing ---------- */
function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: any[]
) {
  ctx.strokeStyle = "#14B8A6"
  ctx.lineWidth = 8
  ctx.lineCap = "round"
  ctx.fillStyle = "#14B8A6"

  const W = ctx.canvas.width
  const H = ctx.canvas.height

  // Helper to draw line
  const line = (a: number, b: number) => {
    ctx.beginPath()
    ctx.moveTo(lm[a].x * W, lm[a].y * H)
    ctx.lineTo(lm[b].x * W, lm[b].y * H)
    ctx.stroke()
  }

  // Helper to draw joint
  const joint = (i: number) => {
    ctx.beginPath()
    ctx.arc(lm[i].x * W, lm[i].y * H, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  /* -------- TORSO -------- */
  line(11, 12) // shoulders
  line(11, 23) // left torso
  line(12, 24) // right torso
  line(23, 24) // hips

  /* -------- LEFT ARM -------- */
  line(11, 13)
  line(13, 15)

  /* -------- RIGHT ARM -------- */
  line(12, 14)
  line(14, 16)

  /* -------- LEFT LEG -------- */
  line(23, 25)
  line(25, 27)

  /* -------- RIGHT LEG -------- */
  line(24, 26)
  line(26, 28)

    /* -------- JOINTS -------- */
    ;[
      11, 12, // shoulders
      13, 14, // elbows
      15, 16, // wrists
      23, 24, // hips
      25, 26, // knees
      27, 28  // ankles
    ].forEach(joint)
}
