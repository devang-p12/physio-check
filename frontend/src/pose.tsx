import { Pose, Results } from "@mediapipe/pose"
import { Camera } from "@mediapipe/camera_utils"
import { calculateAngle } from "./angle"

const LEFT_HIP = 23
const LEFT_KNEE = 25
const LEFT_ANKLE = 27

export function setupPose(socket: WebSocket): void {
  const video = document.getElementById("video") as HTMLVideoElement

  const pose = new Pose({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  })

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  })

  pose.onResults((res: Results) => {
    if (!res.poseLandmarks) return

    const hip = res.poseLandmarks[LEFT_HIP]
    const knee = res.poseLandmarks[LEFT_KNEE]
    const ankle = res.poseLandmarks[LEFT_ANKLE]

    const angle = calculateAngle(hip, knee, ankle)

    socket.send(JSON.stringify({ angle }))
  })

  const camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video })
    },
    width: 640,
    height: 480
  })

  camera.start()
}