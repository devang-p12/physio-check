import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawLandmarkCircle, getLandmarkCoords } from '../../utils/poseUtils';

export interface ExerciseProps {
  onRepComplete: (data: { repNumber: number; holdDuration: number; avgSwayScore: number; timestamp: number }) => void;
  onSessionEnd: (data: { totalReps: number; totalSets: number; duration: number }) => void;
  targetReps?: number; // repurposed as hold attempts
  targetSets?: number;
}

const SingleLegBalanceExercise: React.FC<ExerciseProps> = ({ onRepComplete, onSessionEnd, targetReps = 3 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now());
  const TARGET_DURATION = 10; // seconds 
  const SWAY_THRESHOLD = 8;

  const [repPhase, setRepPhase] = useState<'grounded' | 'balancing' | 'failed'>('grounded');
  const [repCount, setRepCount] = useState(0);
  const [holdTimer, setHoldTimer] = useState(0);
  const [swayScore, setSwayScore] = useState(0);
  const [feedback, setFeedback] = useState({ text: "Lift one foot, hold your balance", color: "text-slate-400" });

  const phaseRef = useRef(repPhase);
  const holdStartRef = useRef<number | null>(null);
  const stanceAnkleXHistory = useRef<number[]>([]);
  
  useEffect(() => { phaseRef.current = repPhase; }, [repPhase]);

  // Handle the internal timer based on phases effectively
  useEffect(() => {
    let interval: any;
    if (repPhase === 'balancing') {
      interval = setInterval(() => {
        setHoldTimer(Math.floor((Date.now() - (holdStartRef.current ?? Date.now())) / 1000));
      }, 500);
    } else {
      setHoldTimer(0);
    }
    return () => clearInterval(interval);
  }, [repPhase]);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      
      const leftAnkle = landmarks[27];
      const rightAnkle = landmarks[28];
      
      // Determine lifted foot (smaller Y = higher)
      const yDeltaArray = Math.abs(leftAnkle.y - rightAnkle.y);
      const isOneFootRaised = yDeltaArray > 0.05;

      const stanceAnkle = leftAnkle.y > rightAnkle.y ? leftAnkle : rightAnkle;

      if (isOneFootRaised) {
        stanceAnkleXHistory.current.push(stanceAnkle.x);
        if (stanceAnkleXHistory.current.length > 30) stanceAnkleXHistory.current.shift();
      } else {
        stanceAnkleXHistory.current = [];
      }

      // Calculate standard deviation of X (sway)
      let currentSway = 0;
      if (stanceAnkleXHistory.current.length > 10) {
        const mean = stanceAnkleXHistory.current.reduce((a,b)=>a+b,0) / stanceAnkleXHistory.current.length;
        const variance = stanceAnkleXHistory.current.reduce((a,b)=>a+Math.pow(b-mean, 2),0) / stanceAnkleXHistory.current.length;
        currentSway = Math.sqrt(variance) * 1000;
        setSwayScore(Math.round(currentSway));
      }

      const color = isOneFootRaised ? (currentSway < SWAY_THRESHOLD ? "#14B8A6" : "#EF4444") : "#64748B";

      drawLandmarkCircle(ctx, leftAnkle, 10, color, canvas.width, canvas.height);
      drawLandmarkCircle(ctx, rightAnkle, 10, color, canvas.width, canvas.height);
      drawLandmarkCircle(ctx, landmarks[25], 10, "#fff", canvas.width, canvas.height);
      drawLandmarkCircle(ctx, landmarks[26], 10, "#fff", canvas.width, canvas.height);

      // Stability Bar
      const stabilityRatio = Math.max(0, 1 - (currentSway / SWAY_THRESHOLD));
      ctx.fillStyle = "#334155";
      ctx.fillRect(canvas.width / 2 - 150, 40, 300, 10);
      ctx.fillStyle = currentSway > SWAY_THRESHOLD ? "#EF4444" : "#14B8A6";
      ctx.fillRect(canvas.width / 2 - 150, 40, 300 * stabilityRatio, 10);

      // Form Check
      if (!isOneFootRaised) {
        setFeedback({ text: "Lift one foot off the ground", color: "text-slate-400" });
        if (phaseRef.current === 'balancing') setRepPhase('failed');
      } else if (currentSway > SWAY_THRESHOLD) {
        setFeedback({ text: "Regain balance!", color: "text-red-500" });
        if (phaseRef.current === 'balancing') setRepPhase('failed');
      } else if (currentSway >= 4 && currentSway <= SWAY_THRESHOLD) {
        setFeedback({ text: "Focus — small wobble", color: "text-amber-500" });
      } else {
        setFeedback({ text: "Excellent stability!", color: "text-teal-400" });
      }

      // Phase handling
      if (isOneFootRaised && currentSway < SWAY_THRESHOLD && phaseRef.current !== 'balancing') {
         if (!holdStartRef.current || phaseRef.current === 'failed') holdStartRef.current = Date.now();
         setRepPhase('balancing');
      }

      const elapsed = Math.floor((Date.now() - (holdStartRef.current ?? Date.now())) / 1000);
      if (phaseRef.current === 'balancing' && elapsed >= TARGET_DURATION) {
         setRepCount(c => c + 1);
         onRepComplete({ repNumber: repCount + 1, holdDuration: elapsed, avgSwayScore: currentSway, timestamp: Date.now() });
         setRepPhase('grounded');
         holdStartRef.current = null;
         stanceAnkleXHistory.current = [];
      }
    }
  }, [onRepComplete, repCount]);

  useEffect(() => {
    if (repCount >= targetReps) {
      onSessionEnd({ totalReps: targetReps, totalSets: 1, duration: Math.floor((Date.now()-startTime.current)/1000) });
    }
  }, [repCount, targetReps, onSessionEnd]);

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
        <div className="text-slate-400 text-xs font-bold uppercase mb-1">Stability Timer</div>
        <div className="text-3xl font-bold text-white">{holdTimer} <span className="text-slate-500 text-sm">/ {TARGET_DURATION}s</span></div>
        <div className={`text-sm mt-1 font-bold ${repPhase === 'balancing' ? 'text-teal-400' : 'text-slate-400'}`}>{repPhase.toUpperCase()}</div>
      </div>
      <div className="absolute top-4 right-4 z-20 flex gap-4">
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl text-center">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Success Attempts</div>
          <div className="text-2xl font-bold text-white">{repCount} <span className="text-slate-500 text-sm">/ {targetReps}</span></div>
        </div>
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-center w-full max-w-lg">
         <h2 className="text-xl font-bold text-white shadow-sm mb-2 opacity-90 drop-shadow-md">Single Leg Balance</h2>
         <div className={`text-2xl font-bold drop-shadow-lg ${feedback.color}`}>{feedback.text}</div>
      </div>
      <button onClick={() => onSessionEnd({totalReps: repCount, totalSets: 1, duration: Math.floor((Date.now() - startTime.current)/1000)})} className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">Stop</button>
    </div>
  );
};
export default SingleLegBalanceExercise;
