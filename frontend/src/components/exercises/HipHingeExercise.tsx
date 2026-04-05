import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { calculateAngle, drawSkeletonLine, drawAngleArc, drawLandmarkCircle, getLandmarkCoords } from '../../utils/poseUtils';

export interface ExerciseProps {
  onRepComplete: (data: { repNumber: number; angle: number; timestamp: number }) => void;
  onSessionEnd: (data: { totalReps: number; totalSets: number; duration: number }) => void;
  targetReps?: number;
  targetSets?: number;
}

const HipHingeExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'up' | 'down'>('up');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Hinge forward at the hips, keep back flat", color: "text-slate-400" });

  const repPhaseRef = useRef(repPhase);
  useEffect(() => { repPhaseRef.current = repPhase; }, [repPhase]);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      
      // Use the side more visible
      const leftVis = landmarks[23].visibility ?? 0;
      const rightVis = landmarks[24].visibility ?? 0;
      const side = leftVis > rightVis ? 'left' : 'right';

      const shoulder = side === 'left' ? landmarks[11] : landmarks[12];
      const hip = side === 'left' ? landmarks[23] : landmarks[24];
      const knee = side === 'left' ? landmarks[25] : landmarks[26];
      const ankle = side === 'left' ? landmarks[27] : landmarks[28];

      const hipAngle = calculateAngle(shoulder, hip, knee);
      const kneeAngle = calculateAngle(hip, knee, ankle);
      setCurrentAngle(Math.round(hipAngle));

      // Spine roundness (checking horizontal relationship if side-on)
      const spineTilt = Math.abs(shoulder.x - hip.x);

      const isUp = hipAngle > 160;
      const isDown = hipAngle < 70;
      const color = isUp || isDown ? "#14B8A6" : "#64748B";

      drawSkeletonLine(ctx, shoulder, hip, color, canvas.width, canvas.height);
      drawSkeletonLine(ctx, hip, knee, color, canvas.width, canvas.height);
      drawLandmarkCircle(ctx, hip, 5, "#fff", canvas.width, canvas.height);
      
      const hipCoords = getLandmarkCoords(hip, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(hipCoords.x, hipCoords.y);
      ctx.lineTo(hipCoords.x, hipCoords.y + 100);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#94A3B8';
      ctx.stroke();
      ctx.setLineDash([]);
      
      drawAngleArc(ctx, hip, hipAngle, 40, color, canvas.width, canvas.height, "Hip: ");

      // Form Check
      if (kneeAngle < 150 && repPhaseRef.current === 'down') {
        setFeedback({ text: "Slight bend is OK, don't squat", color: "text-amber-500" });
      } else if (spineTilt > 0.3 && hipAngle > 90) { // arbitrary threshold for rounding back
        setFeedback({ text: "Keep back flat!", color: "text-red-500" });
      } else if (hipAngle >= 160) {
        setFeedback({ text: "Stand tall", color: "text-teal-400" });
      } else if (hipAngle < 70) {
        setFeedback({ text: "Perfect hinge!", color: "text-teal-500" });
      } else {
        setFeedback({ text: repPhaseRef.current === 'up' ? "Hinge forward at the hips, keep back flat" : "Drive hips back to stand up", color: "text-slate-300" });
      }

      if (hipAngle < 70 && repPhaseRef.current === 'up') {
        setRepPhase('down');
      } else if (hipAngle > 160 && repPhaseRef.current === 'down') {
        setRepPhase('up');
        setRepCount(c => {
          const newCount = c + 1;
          onRepComplete({ repNumber: newCount, angle: hipAngle, timestamp: Date.now() });
          return newCount;
        });
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
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Hip Hinge</div>
        <div className="text-3xl font-bold text-white">{currentAngle}°</div>
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
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Hip Hinge</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default HipHingeExercise;
