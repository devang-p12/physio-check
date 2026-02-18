import React, { useState, useEffect, useRef } from "react";
import {
  X,
  RefreshCcw,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { usePose } from "@/hooks/usePose";

const ExerciseSession = () => {
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [reps, setReps] = useState(0);
  const [postureStatus, setPostureStatus] =
    useState<"correct" | "incorrect">("correct");
  const [timer, setTimer] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    let interval: number | undefined;

    if (isActive) {
      interval = window.setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  /* ---------------- POSE HOOK ---------------- */
  usePose({
    videoRef,
    canvasRef,
    isActive,
    onRepUpdate: setReps,
    onPostureUpdate: setPostureStatus,
  });

  return (
    <div className="h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* --- LEFT AREA: LIVE CAMERA FEED --- */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-900/10 z-10" />

        {/* CAMERA */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
          autoPlay
        />

        {/* SKELETON CANVAS */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10 pointer-events-none"
        />

        {/* Live Feedback Overlay */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-colors duration-300 ${
              postureStatus === "correct"
                ? "bg-teal-500/20 border-teal-400/50 text-teal-300"
                : "bg-red-500/20 border-red-400/50 text-red-300"
            }`}
          >
            {postureStatus === "correct" ? (
              <>
                <CheckCircle2 size={24} fill="currentColor" />
                <span className="font-bold tracking-wide">
                  Posture Correct
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={24} fill="currentColor" />
                <span className="font-bold tracking-wide">
                  Straighten Back!
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- RIGHT SIDEBAR --- */}
      <div className="w-full md:w-[400px] bg-white flex flex-col h-1/2 md:h-full relative z-30 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1 block">
              Leg Strength
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Squats</h1>
          </div>
          <button
            onClick={() => navigate("/patient")}
            className="p-2 -mr-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <span className="text-xs text-slate-500 font-bold uppercase">
                Reps
              </span>
              <div className="text-4xl font-bold text-slate-900 mt-1">
                {reps}
                <span className="text-sm text-slate-400 font-medium"> / 15</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <span className="text-xs text-slate-500 font-bold uppercase">
                Duration
              </span>
              <div className="text-4xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatTime(timer)}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs">
                i
              </span>
              Instructions
            </h3>
            <ul className="space-y-4">
              {[
                "Stand with feet shoulder-width apart.",
                "Keep your back straight and chest up.",
                "Lower hips until thighs are parallel to floor.",
                "Push through heels to return to start.",
              ].map((step, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 text-sm text-slate-600 leading-relaxed"
                >
                  <span className="font-bold text-slate-300">{idx + 1}.</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {/* Tip */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-900 text-sm mb-2">💡 Pro Tip</h4>
            <p className="text-xs text-blue-700">
              Ensure your knees don't go past your toes to avoid injury.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white">
          {!isActive ? (
            <button
              onClick={() => setIsActive(true)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2"
            >
              <Play size={24} fill="currentColor" />
              Start Session
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setIsActive(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Pause size={20} fill="currentColor" />
                Pause
              </button>
              <button
                onClick={() => setReps(0)}
                className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center"
              >
                <RefreshCcw size={20} />
              </button>
              <button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg">
                Finish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseSession;