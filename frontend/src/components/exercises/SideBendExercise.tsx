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

const SideBendExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'center' | 'bend'>('center');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Reach one arm down your leg, bend sideways", color: "text-slate-400" });

  const repPhaseRef = useRef(repPhase);
  const initialHipMidX = useRef<number | null>(null);

  useEffect(() => { repPhaseRef.current = repPhase; }, [repPhase]);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      
      const shoulderMid = { x: (landmarks[11].x + landmarks[12].x)/2, y: (landmarks[11].y + landmarks[12].y)/2, z: 0 };
      const hipMid = { x: (landmarks[23].x + landmarks[24].x)/2, y: (landmarks[23].y + landmarks[24].y)/2, z: 0 };
      
      if (!initialHipMidX.current) {
        initialHipMidX.current = hipMid.x;
      }

      // Calculate tilt angle using atan2
      const tiltAngleRad = Math.atan2(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y);
      const tiltAngle = tiltAngleRad * 180 / Math.PI;
      // Convert to strict -deg to +deg relative to vertical
      setCurrentAngle(Math.round(Math.abs(tiltAngle)));

      const isBend = Math.abs(tiltAngle) > 20;
      const isMover = Math.abs(tiltAngle) > 5 && Math.abs(tiltAngle) <= 20;
      let color = "#64748B";
      if (tiltAngle > 20) color = "#14B8A6"; // Right bend
      if (tiltAngle < -20) color = "#3B82F6"; // Left bend

      // Draw Spine line
      const sC = getLandmarkCoords(shoulderMid, canvas.width, canvas.height);
      const hC = getLandmarkCoords(hipMid, canvas.width, canvas.height);

      ctx.beginPath(); ctx.moveTo(sC.x, sC.y); ctx.lineTo(hC.x, hC.y);
      ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.stroke();

      ctx.beginPath(); ctx.moveTo(hC.x, hC.y); ctx.lineTo(hC.x, hC.y - 150);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = "bold 18px Inter, sans-serif";
      ctx.fillText(`Tilt: ${Math.round(Math.abs(tiltAngle))}°`, hC.x + 20, hC.y - 20);

      // Form Check
      const hipShift = Math.abs(hipMid.x - initialHipMidX.current);
      const shoulderDepthShift = Math.abs(landmarks[11].z - landmarks[12].z);

      if (hipShift > 0.05) {
        setFeedback({ text: "Keep hips still", color: "text-red-500" });
      } else if (shoulderDepthShift > 0.2) {
        setFeedback({ text: "Bend sideways, don't rotate", color: "text-amber-500" });
      } else if (isBend) {
        setFeedback({ text: "Good stretch!", color: "text-teal-500" });
      } else {
        setFeedback({ text: repPhaseRef.current === 'center' ? "Reach one arm down your leg, bend sideways" : "Hold the stretch, then return to center", color: "text-slate-300" });
      }

      if (Math.abs(tiltAngle) < 5 && repPhaseRef.current === 'bend') {
        setRepPhase('center');
        setRepCount(c => {
          const newCount = c + 1;
          onRepComplete({ repNumber: newCount, angle: Math.abs(tiltAngle), timestamp: Date.now() });
          return newCount;
        });
      } else if (Math.abs(tiltAngle) > 20 && repPhaseRef.current === 'center') {
        setRepPhase('bend');
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
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Tilt Angle</div>
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
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Side Bend</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default SideBendExercise;
