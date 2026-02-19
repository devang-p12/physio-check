import { useEffect, RefObject } from "react";
import { Pose, Results, LandmarkList } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { processPose, resetPoseState } from "@/utils/poseLogic";

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  isActive: boolean;
  isRecording?: boolean;
  onFrameCapture?: (landmarks: LandmarkList) => void;
  onRepUpdate: (reps: number) => void;
  onPostureUpdate: (status: "correct" | "incorrect") => void;
  // NEW: Pass the target peak pose to draw the ghost skeleton
  ghostPose?: LandmarkList | null; 
}

export function usePose({
  videoRef,
  canvasRef,
  isActive,
  isRecording = false,
  onFrameCapture,
  onRepUpdate,
  onPostureUpdate,
  ghostPose = null,
}: Props) {
  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    resetPoseState();

    const pose = new Pose({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    pose.onResults((results: Results) => {
      if (!results.poseLandmarks) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- RECORDING LOGIC ---
      if (isRecording && onFrameCapture) {
        onFrameCapture(results.poseLandmarks);
      }

      // --- EXERCISE LOGIC ---
      const { reps, posture } = processPose(results.poseLandmarks);
      onRepUpdate(reps);
      onPostureUpdate(posture);

      // --- DRAWING ---
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);

      // 1. Draw the "Ghost" Skeleton (Target/Peak Pose)
      if (ghostPose) {
        // Render in semi-transparent white with thinner lines
        drawSkeleton(ctx, ghostPose, "rgba(255, 255, 255, 0.3)", 4);
      }

      // 2. Draw the Live Camera Skeleton
      drawSkeleton(ctx, results.poseLandmarks, "#14B8A6", 8);

      ctx.restore();
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await pose.send({ image: video });
      },
      width: 640,
      height: 480
    });

    camera.start();

    return () => {
      camera.stop();
      pose.close();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isActive, isRecording, ghostPose]); // Depend on ghostPose to re-render
}

/* ---------- Skeleton Drawing ---------- */
/**
 * Updated to support dynamic colors and thickness
 */
function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: any[],
  color: string,
  lineWidth: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.fillStyle = color;

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // Helper to draw line
  const line = (a: number, b: number) => {
    if (!lm[a] || !lm[b]) return;
    ctx.beginPath();
    ctx.moveTo(lm[a].x * W, lm[a].y * H);
    ctx.lineTo(lm[b].x * W, lm[b].y * H);
    ctx.stroke();
  };

  // Helper to draw joint
  const joint = (i: number) => {
    if (!lm[i]) return;
    ctx.beginPath();
    ctx.arc(lm[i].x * W, lm[i].y * H, lineWidth * 0.7, 0, Math.PI * 2);
    ctx.fill();
  };

  /* -------- TORSO -------- */
  line(11, 12); // shoulders
  line(11, 23); // left torso
  line(12, 24); // right torso
  line(23, 24); // hips

  /* -------- ARMS -------- */
  line(11, 13); line(13, 15); // left
  line(12, 14); line(14, 16); // right

  /* -------- LEGS -------- */
  line(23, 25); line(25, 27); // left
  line(24, 26); line(26, 28); // right

  /* -------- JOINTS -------- */
  [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(joint);
}