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

const ElbowFlexionExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'down' | 'up'>('down');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(180);
  const [feedback, setFeedback] = useState({ text: "Curl your arm up, keeping elbow at your side", color: "text-slate-400" });

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
      
      const leftWrist = landmarks[15], rightWrist = landmarks[16];
      const side = leftWrist.y < rightWrist.y ? 'left' : 'right';

      const shoulder = side === 'left' ? landmarks[11] : landmarks[12];
      const elbow = side === 'left' ? landmarks[13] : landmarks[14];
      const wrist = side === 'left' ? landmarks[15] : landmarks[16];

      const elbowAngle = calculateAngle(shoulder, elbow, wrist);
      setCurrentAngle(Math.round(elbowAngle));

      const isUp = elbowAngle < 50;
      const isMover = elbowAngle >= 50 && elbowAngle <= 150;
      const color = isUp ? "#14B8A6" : (isMover ? "#0EA5E9" : "#64748B");

      drawSkeletonLine(ctx, shoulder, elbow, color, canvas.width, canvas.height);
      drawSkeletonLine(ctx, elbow, wrist, color, canvas.width, canvas.height);
      drawLandmarkCircle(ctx, shoulder, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, elbow, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, wrist, 5, "#fff", canvas.width, canvas.height);
      
      drawAngleArc(ctx, elbow, elbowAngle, 30, color, canvas.width, canvas.height, "Curl: ");

      // Form Check
      // Check if elbow drifted forward (x displacement between shoulder and elbow)
      const elbowDrift = Math.abs(elbow.x - shoulder.x);
      
      // Shrug detection: opp shoulder vs active shoulder
      const oppShoulder = side === 'left' ? landmarks[12] : landmarks[11];
      const shrug = (oppShoulder.y - shoulder.y) > 0.05;

      if (elbowDrift > 0.15) {
        setFeedback({ text: "Keep elbow at your side", color: "text-red-500" });
      } else if (shrug) {
        setFeedback({ text: "Don't shrug your shoulder", color: "text-amber-500" });
      } else if (elbowAngle < 50) {
        setFeedback({ text: "Full range!", color: "text-teal-500" });
      } else {
        setFeedback({ text: repPhaseRef.current === 'down' ? "Curl your arm up, keeping elbow at your side" : "Squeeze at the top, then lower slowly", color: "text-slate-300" });
      }

      if (elbowAngle > 150 && repPhaseRef.current === 'up') {
        setRepPhase('down');
        setRepCount(c => {
          const newCount = c + 1;
          onRepComplete({ repNumber: newCount, angle: elbowAngle, timestamp: Date.now() });
          return newCount;
        });
      } else if (elbowAngle < 50 && repPhaseRef.current === 'down') {
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
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Elbow Angle</div>
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
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Elbow Flexion</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default ElbowFlexionExercise;
