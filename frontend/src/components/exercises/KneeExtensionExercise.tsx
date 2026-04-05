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

const KneeExtensionExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 10, targetSets = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());

  const [repPhase, setRepPhase] = useState<'down' | 'up'>('down');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Slowly raise your leg", color: "text-slate-400" });

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
      
      // Active Side Detection logic: which ankle (27 left, 28 right) is moving more in Y relative to hip
      const leftHip = landmarks[23], rightHip = landmarks[24];
      const leftAnkle = landmarks[27], rightAnkle = landmarks[28];
      
      let side = 'left';
      if ((leftAnkle.y - leftHip.y) > (rightAnkle.y - rightHip.y)) {
         side = 'left'; 
      }
      // Knee Extension usually the moving foot is higher (lower Y value) when extending or it's clearly moving.
      // Actually, standard heuristic: pick the side with the higher ankle (closer to 0 in y, meaning it's raised)
      side = leftAnkle.y < rightAnkle.y ? 'left' : 'right';

      const hip = side === 'left' ? landmarks[23] : landmarks[24];
      const knee = side === 'left' ? landmarks[25] : landmarks[26];
      const ankle = side === 'left' ? landmarks[27] : landmarks[28];
      const shoulder = side === 'left' ? landmarks[11] : landmarks[12];

      const angle = calculateAngle(hip, knee, ankle);
      setCurrentAngle(Math.round(angle));

      // Draw active leg skeleton
      const isUp = angle > 150;
      const isMover = angle > 30 && angle <= 150;
      const color = isUp ? "#14B8A6" : (isMover ? "#0EA5E9" : "#64748B"); // green when ext, teal when moving, gray down

      drawSkeletonLine(ctx, hip, knee, color, canvas.width, canvas.height);
      drawSkeletonLine(ctx, knee, ankle, color, canvas.width, canvas.height);
      drawLandmarkCircle(ctx, hip, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, knee, 5, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, ankle, 5, "#fff", canvas.width, canvas.height);
      drawAngleArc(ctx, knee, angle, 30, color, canvas.width, canvas.height, "Ext: ");

      // Form checking
      if (shoulder.y > hip.y - 0.1) {
        setFeedback({ text: "Sit upright", color: "text-red-500" });
      } else if (angle > 150) {
        setFeedback({ text: "Hold — full extension!", color: "text-teal-500" });
      } else if (angle > 30 && angle <= 90) {
        setFeedback({ text: "Keep extending!", color: "text-amber-500" });
      } else {
         setFeedback({ text: repPhaseRef.current === 'down' ? "Slowly raise your leg" : "Hold for 2 seconds, then lower", color: "text-slate-300" });
      }

      // State Machine: DOWN (<30) -> UP (>150) -> DOWN
      if (angle < 30 && repPhaseRef.current === 'up') {
        setRepPhase('down');
        setRepCount(c => {
          const newCount = c + 1;
          onRepComplete({ repNumber: newCount, angle, timestamp: Date.now() });
          return newCount;
        });
      } else if (angle > 150 && repPhaseRef.current === 'down') {
        setRepPhase('up');
      }
    }
  }, [onRepComplete]);

  useEffect(() => {
    if (repCount >= targetReps) {
      setRepCount(0);
      setSetCount(s => {
        const newSets = s + 1;
        if (newSets >= targetSets) {
          const duration = Math.floor((Date.now() - startTime.current) / 1000);
          onSessionEnd({ totalReps: targetReps * targetSets, totalSets: targetSets, duration });
        }
        return newSets;
      });
    }
  }, [repCount, targetReps, targetSets, onSessionEnd]);

  useEffect(() => {
    let camera: Camera | null = null;
    let pose: Pose | null = null;

    if (videoRef.current) {
      pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
      pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, smoothSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      pose.onResults(onResults);

      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await pose?.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });
      camera.start();
    }
    return () => {
      camera?.stop();
      pose?.close();
    };
  }, [onResults]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10 pointer-events-none" width={640} height={480} />
      
      {/* HUD Top Left */}
      <div className="absolute top-4 left-4 z-20 bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl">
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Knee Angle</div>
        <div className="text-3xl font-bold text-white">{currentAngle}°</div>
        <div className="text-teal-400 text-sm mt-1">{repPhase.toUpperCase()} PHASE</div>
      </div>

      {/* HUD Top Right */}
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

      {/* Bottom Instruction */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-center w-full max-w-lg">
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Knee Extension</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>

      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: setCount, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">
        Stop Session
      </button>
    </div>
  );
};

export default KneeExtensionExercise;
