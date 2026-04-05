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

const LateralLegRaiseExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'down' | 'up'>('down');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Lift your leg out to the side", color: "text-slate-400" });

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
      
      const leftHip = landmarks[23], rightHip = landmarks[24];
      const leftKnee = landmarks[25], rightKnee = landmarks[26];
      const leftShoulder = landmarks[11], rightShoulder = landmarks[12];
      
      const hipMidX = (leftHip.x + rightHip.x) / 2;
      const leftDX = Math.abs(leftKnee.x - leftHip.x);
      const rightDX = Math.abs(rightKnee.x - rightHip.x);
      
      const side = leftDX > rightDX ? 'left' : 'right';
      
      const activeHip = side === 'left' ? leftHip : rightHip;
      const activeKnee = side === 'left' ? leftKnee : rightKnee;
      const activeAnkle = side === 'left' ? landmarks[27] : landmarks[28];
      
      // Calculate angle from vertical midline
      const verticalPseudoLmk = { x: activeHip.x, y: activeHip.y + 0.2, z: activeHip.z };
      const abdAngle = calculateAngle(verticalPseudoLmk, activeHip, activeKnee);
      setCurrentAngle(Math.round(abdAngle));

      const isUp = abdAngle > 35;
      const isMover = abdAngle > 10 && abdAngle <= 35;
      const color = isUp ? "#14B8A6" : (isMover ? "#0EA5E9" : "#64748B");

      drawLandmarkCircle(ctx, leftHip, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, rightHip, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, leftKnee, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, rightKnee, 5, "#fff", canvas.width, canvas.height);

      drawSkeletonLine(ctx, activeHip, activeKnee, color, canvas.width, canvas.height);
      
      const hipCoords = getLandmarkCoords(activeHip, canvas.width, canvas.height);
      ctx.beginPath(); ctx.moveTo(hipCoords.x, hipCoords.y); ctx.lineTo(hipCoords.x, hipCoords.y + 150);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = '#94A3B8'; ctx.stroke(); ctx.setLineDash([]);
      
      drawAngleArc(ctx, activeHip, abdAngle, 40, color, canvas.width, canvas.height, "Abd: ");

      // Form Check
      const kneeBend = calculateAngle(activeHip, activeKnee, activeAnkle);
      const trunkLean = calculateAngle({x: hipMidX, y: leftShoulder.y, z:0}, {x: hipMidX, y: leftHip.y, z:0}, {x: (leftShoulder.x+rightShoulder.x)/2, y: (leftShoulder.y+rightShoulder.y)/2, z:0});

      if (Math.abs(leftHip.y - rightHip.y) > 0.04) {
        setFeedback({ text: "Don't drop your hip", color: "text-red-500" });
      } else if (kneeBend < 155) {
        setFeedback({ text: "Keep leg straight", color: "text-amber-500" });
      } else if (trunkLean > 15 && trunkLean < 165) {
        setFeedback({ text: "Stay upright", color: "text-red-500" });
      } else if (isUp) {
        setFeedback({ text: "Perfect!", color: "text-teal-500" });
      } else {
        setFeedback({ text: repPhaseRef.current === 'down' ? "Lift your leg out to the side, keep toes forward" : "Hold and control — lower slowly", color: "text-slate-300" });
      }

      if (abdAngle < 10 && repPhaseRef.current === 'up') {
        setRepPhase('down');
        setRepCount(c => {
          const newCount = c + 1;
          onRepComplete({ repNumber: newCount, angle: abdAngle, timestamp: Date.now() });
          return newCount;
        });
      } else if (abdAngle > 35 && repPhaseRef.current === 'down') {
        setRepPhase('up');
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
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Abduction Angle</div>
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
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Lateral Leg Raise</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default LateralLegRaiseExercise;
