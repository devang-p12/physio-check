import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { calculateAngle, drawSkeletonLine, drawAngleArc, drawLandmarkCircle } from '../../utils/poseUtils';

export interface ExerciseProps {
  onRepComplete: (data: { repNumber: number; angle: number; timestamp: number }) => void;
  onSessionEnd: (data: { totalReps: number; totalSets: number; duration: number }) => void;
  targetReps?: number;
  targetSets?: number;
}

const ShoulderAbductionExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'down' | 'up'>('down');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Raise your arm out to the side", color: "text-slate-400" });

  const repPhaseRef = useRef(repPhase);
  const wristHistory = useRef<Array<{l: number, r: number}>>([]);

  useEffect(() => { repPhaseRef.current = repPhase; }, [repPhase]);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      
      // Buffer wrist history to detect active side
      wristHistory.current.push({ l: landmarks[15].y, r: landmarks[16].y });
      if (wristHistory.current.length > 5) wristHistory.current.shift();

      let leftDelta = 0, rightDelta = 0;
      if (wristHistory.current.length === 5) {
        leftDelta = Math.abs(wristHistory.current[0].l - wristHistory.current[4].l);
        rightDelta = Math.abs(wristHistory.current[0].r - wristHistory.current[4].r);
      }

      const side = leftDelta > rightDelta ? 'left' : 'right';

      const hip = side === 'left' ? landmarks[23] : landmarks[24];
      const shoulder = side === 'left' ? landmarks[11] : landmarks[12];
      const oppShoulder = side === 'left' ? landmarks[12] : landmarks[11];
      const elbow = side === 'left' ? landmarks[13] : landmarks[14];
      const wrist = side === 'left' ? landmarks[15] : landmarks[16];

      const abdAngle = calculateAngle(hip, shoulder, elbow);
      const elbowAngle = calculateAngle(shoulder, elbow, wrist);
      setCurrentAngle(Math.round(abdAngle));

      const isUp = abdAngle > 80;
      const isMover = abdAngle > 40 && abdAngle <= 80;
      const color = isUp ? "#14B8A6" : (isMover ? "#0EA5E9" : "#64748B");

      drawSkeletonLine(ctx, hip, shoulder, color, canvas.width, canvas.height);
      drawSkeletonLine(ctx, shoulder, elbow, color, canvas.width, canvas.height);
      drawSkeletonLine(ctx, elbow, wrist, color, canvas.width, canvas.height);
      drawLandmarkCircle(ctx, shoulder, 5, "#fff", canvas.width, canvas.height);
      drawAngleArc(ctx, shoulder, abdAngle, 40, color, canvas.width, canvas.height, "Abd: ");

      // Form Check
      if (Math.abs(shoulder.y - oppShoulder.y) > 0.05) {
        setFeedback({ text: "Don't lean", color: "text-red-500" });
      } else if (elbowAngle < 150) {
        setFeedback({ text: "Keep arm straight", color: "text-amber-500" });
      } else if (abdAngle > 150) {
        setFeedback({ text: "Excellent full extension!", color: "text-teal-400" });
      } else if (abdAngle > 80) {
        setFeedback({ text: "Good height!", color: "text-teal-500" });
      } else {
        setFeedback({ text: repPhaseRef.current === 'down' ? "Raise your arm out to the side" : "Hold at shoulder height, then lower slowly", color: "text-slate-300" });
      }

      if (abdAngle < 20 && repPhaseRef.current === 'up') {
        setRepPhase('down');
        setRepCount(c => {
          const newCount = c + 1;
          onRepComplete({ repNumber: newCount, angle: abdAngle, timestamp: Date.now() });
          return newCount;
        });
      } else if (abdAngle > 80 && repPhaseRef.current === 'down') {
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
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Shoulder Angle</div>
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
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Shoulder Abduction</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default ShoulderAbductionExercise;
