import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { calculateAngle, drawSkeletonLine, drawLandmarkCircle, getLandmarkCoords } from '../../utils/poseUtils';

export interface ExerciseProps {
  onRepComplete: (data: { repNumber: number; angle: number; timestamp: number }) => void;
  onSessionEnd: (data: { totalReps: number; totalSets: number; duration: number }) => void;
  targetReps?: number;
  targetSets?: number;
}

const CalfRaiseExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'down' | 'up'>('down');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Rise up onto your toes", color: "text-slate-400" });

  const repPhaseRef = useRef(repPhase);
  const baselineRef = useRef<number[]>([]);
  const baseValueRef = useRef<number | null>(null);

  useEffect(() => { repPhaseRef.current = repPhase; }, [repPhase]);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      
      const leftKnee = landmarks[25], rightKnee = landmarks[26];
      const leftAnkle = landmarks[27], rightAnkle = landmarks[28];
      
      const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

      if (baselineRef.current.length < 10 && !baseValueRef.current) {
        baselineRef.current.push(avgAnkleY);
        if (baselineRef.current.length === 10) {
          baseValueRef.current = baselineRef.current.reduce((a, b) => a + b, 0) / 10;
        }
      }

      if (baseValueRef.current !== null) {
        // Vertical rise in normalized coords * height = pixels
        const verticalRise = (baseValueRef.current - avgAnkleY) * canvas.height;

        const isUp = verticalRise > 20;
        const color = isUp ? "#14B8A6" : "#64748B";

        drawLandmarkCircle(ctx, leftAnkle, 10, color, canvas.width, canvas.height);
        drawLandmarkCircle(ctx, rightAnkle, 10, color, canvas.width, canvas.height);

        const baseYPx = baseValueRef.current * canvas.height;
        ctx.beginPath(); ctx.moveTo(0, baseYPx); ctx.lineTo(canvas.width, baseYPx);
        ctx.setLineDash([5, 5]); ctx.strokeStyle = '#94A3B8'; ctx.stroke(); ctx.setLineDash([]);

        const currYPx = avgAnkleY * canvas.height;
        ctx.beginPath(); ctx.moveTo(0, currYPx); ctx.lineTo(canvas.width, currYPx);
        ctx.strokeStyle = '#0EA5E9'; ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = "bold 18px Inter, sans-serif";
        ctx.fillText(`Rise: ${Math.round(verticalRise)}px`, rightAnkle.x * canvas.width + 20, currYPx);

        const leftKneeAngle = calculateAngle(landmarks[23], leftKnee, leftAnkle);
        const rightKneeAngle = calculateAngle(landmarks[24], rightKnee, rightAnkle);
        const asymmetry = Math.abs((leftAnkle.y - rightAnkle.y) * canvas.height);

        if (asymmetry > 15) {
          setFeedback({ text: "Rise evenly on both feet", color: "text-amber-500" });
        } else if (leftKneeAngle < 160 || rightKneeAngle < 160) {
          setFeedback({ text: "Keep knees straight", color: "text-amber-500" });
        } else if (isUp) {
          setFeedback({ text: "Great form!", color: "text-teal-500" });
        } else {
          setFeedback({ text: repPhaseRef.current === 'down' ? "Rise up onto your toes" : "Hold, then lower slowly — 3 seconds down", color: "text-slate-300" });
        }

        if (verticalRise < 5 && repPhaseRef.current === 'up') {
          setRepPhase('down');
          setRepCount(c => {
            const newCount = c + 1;
            onRepComplete({ repNumber: newCount, angle: verticalRise, timestamp: Date.now() });
            return newCount;
          });
        } else if (verticalRise > 20 && repPhaseRef.current === 'down') {
          setRepPhase('up');
        }
      } else {
        setFeedback({ text: "Stand still to calibrate...", color: "text-blue-400" });
      }
    }
  }, [onRepComplete]);

  useEffect(() => {
    if (repCount >= targetReps) {
      setRepCount(0);
      setSetCount(s => {
        const ns = s + 1;
        if (ns >= targetSets) onSessionEnd({ totalReps: targetReps*targetSets, totalSets: targetSets, duration: Math.floor((Date.now()-startTime.current)/1000) });
        return ns;
      });
    }
  }, [repCount, targetReps, targetSets, onSessionEnd]);

  useEffect(() => {
    let camera: Camera | null = null;
    let pose: Pose | null = null;
    if (videoRef.current) {
      pose = new Pose({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
      pose.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      pose.onResults(onResults);
      camera = new Camera(videoRef.current, { onFrame: async () => { if (videoRef.current) await pose?.send({ image: videoRef.current }); }, width: 640, height: 480 });
      camera.start();
    }
    return () => { camera?.stop(); pose?.close(); };
  }, [onResults]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10 pointer-events-none" width={640} height={480} />
      
      <div className="absolute top-4 left-4 z-20 bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl">
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Calf Raise</div>
        <div className="text-teal-400 text-sm mt-1">{repPhase.toUpperCase()} PHASE</div>
      </div>
      <div className="absolute top-4 right-4 z-20 flex gap-4">
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl text-center">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Reps</div>
          <div className="text-2xl font-bold text-white">{repCount} <span className="text-slate-500 text-sm">/ {targetReps}</span></div>
        </div>
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl text-center">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Sets</div>
          <div className="text-2xl font-bold text-white">{setCount} <span className="text-slate-500 text-sm">/ {targetSets}</span></div>
        </div>
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-center w-full max-w-lg">
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Calf Raise</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default CalfRaiseExercise;
