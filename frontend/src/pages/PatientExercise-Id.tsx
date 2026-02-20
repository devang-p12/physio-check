import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  RefreshCcw,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePose } from "@/hooks/usePose";
import { apiFetch } from "../api";

interface SetResult {
  setNumber: number;
  performedReps: number;
  accuracy: number;
}

const ExerciseSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("id");

  // --- Exercise & Prescription State ---
  const [exerciseData, setExerciseData] = useState<any>(null);
  const [prescription, setPrescription] = useState<{
    sets: number;
    repsPerSet: number;
  } | null>(null);

  // --- Session Tracking State ---
  const [isActive, setIsActive] = useState(false);
  const [timer, setTimer] = useState(0);
  // reps: counts WITHIN the current set only (reset each set)
  const [reps, setReps] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [postureStatus, setPostureStatus] = useState<"correct" | "incorrect">(
    "correct"
  );
  const [completedSets, setCompletedSets] = useState<SetResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  // Refs to always have latest values inside callbacks without stale closures
  const repsRef = useRef(0);
  const currentSetRef = useRef(1);
  const prescriptionRef = useRef(prescription);
  const completedSetsRef = useRef<SetResult[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep refs in sync
  useEffect(() => {
    repsRef.current = reps;
  }, [reps]);

  useEffect(() => {
    currentSetRef.current = currentSet;
  }, [currentSet]);

  useEffect(() => {
    prescriptionRef.current = prescription;
  }, [prescription]);

  useEffect(() => {
    completedSetsRef.current = completedSets;
  }, [completedSets]);

  /* ---------------- FETCH EXERCISE DATA ---------------- */
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const data = await apiFetch(`/patient/assignment/${assignmentId}`);
        setExerciseData(data.exercise);
        const parsedPrescription =
          typeof data.prescription === "string"
            ? JSON.parse(data.prescription)
            : data.prescription;
        setPrescription(parsedPrescription);
      } catch (err) {
        console.error("Failed to fetch assignment details", err);
      }
    };

    if (assignmentId) fetchAssignment();
  }, [assignmentId]);

  /* ---------------- SET LOGIC ---------------- */
  // Called by the pose hook each time a rep is detected.
  // Using useCallback + refs so usePose always gets a stable, non-stale callback.
  const handleRepUpdate = useCallback((totalRepsFromHook: number) => {
    const p = prescriptionRef.current;
    if (!p) return;

    // The hook reports a cumulative count; we track per-set reps via the ref baseline.
    // SIMPLER APPROACH: treat the hook's value as the per-set counter directly.
    // To reset between sets, we tell the hook to reset (see resetReps below).
    const newReps = totalRepsFromHook;
    setReps(newReps);
    repsRef.current = newReps;

    // Auto-complete set when target reps are reached
    if (newReps >= p.repsPerSet) {
      completeCurrentSet(newReps);
    }
  }, []); // empty deps — uses refs internally

  // Separated into its own stable function to avoid closure issues
  const completeCurrentSet = useCallback(
    (finalReps: number) => {
      const p = prescriptionRef.current;
      if (!p) return;

      const setNum = currentSetRef.current;

      // Guard: don't double-record the same set
      if (completedSetsRef.current.some((s) => s.setNumber === setNum)) return;

      const setData: SetResult = {
        setNumber: setNum,
        performedReps: finalReps,
        accuracy: 95,
      };

      const updatedSets = [...completedSetsRef.current, setData];
      completedSetsRef.current = updatedSets;
      setCompletedSets(updatedSets);
      setIsActive(false);

      if (setNum < p.sets) {
        // More sets to go
        alert(
          `Set ${setNum} complete! (${finalReps} reps)\nPrepare for Set ${setNum + 1}`
        );
        const nextSet = setNum + 1;
        currentSetRef.current = nextSet;
        setCurrentSet(nextSet);
        repsRef.current = 0;
        setReps(0);
        // Signal pose hook to reset its rep counter (handled via resetRepsSignal)
        setResetRepsSignal((s) => s + 1);
      } else {
        // All sets done
        setSessionDone(true);
        alert("All prescribed sets completed! Click Finish to save.");
      }
    },
    [] // uses only refs
  );

  // Signal to tell usePose to reset its internal rep counter
  const [resetRepsSignal, setResetRepsSignal] = useState(0);

  /* ---------------- MANUAL SET COMPLETION (button) ---------------- */
  const handleManualSetComplete = () => {
    completeCurrentSet(repsRef.current);
  };

  /* ---------------- DB SYNC: FINISH ---------------- */
  const handleFinish = async () => {
    if (isSubmitting || !prescription) return;
    setIsSubmitting(true);

    try {
      // Build final sets array from already-recorded sets
      const finalSets = [...completedSetsRef.current];

      // If user clicks Finish mid-set (partial reps, set not yet completed),
      // record whatever progress exists — but only if it hasn't been recorded yet.
      const currentSetAlreadyRecorded = finalSets.some(
        (s) => s.setNumber === currentSetRef.current
      );
      if (!currentSetAlreadyRecorded && repsRef.current > 0) {
        finalSets.push({
          setNumber: currentSetRef.current,
          performedReps: repsRef.current,
          accuracy: 90,
        });
      }

      console.log("🚀 Sending to Backend:", { assignmentId, sets: finalSets });

      const response = await apiFetch("/patient/complete-exercise", {
        method: "POST",
        body: JSON.stringify({
          assignmentId: assignmentId,
          sets: finalSets,
        }),
      });

      console.log("✅ Server Response:", response);
      navigate("/patient");
    } catch (error) {
      console.error("❌ Save Error:", error);
      alert("Failed to save progress. Please check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    let interval: number | undefined;
    if (isActive) {
      interval = window.setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
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
    onRepUpdate: handleRepUpdate,   // stable callback via useCallback
    onPostureUpdate: setPostureStatus,
    resetSignal: resetRepsSignal,   // pose hook should reset its counter when this changes
  });

  /* ---------------- LOADING GUARD ---------------- */
  if (!exerciseData || !prescription) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 text-lg">
        Loading Exercise Plan...
      </div>
    );
  }

  const allSetsDone = sessionDone || completedSets.length >= prescription.sets;

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* --- LEFT AREA: LIVE CAMERA FEED --- */}
      <div className="relative flex-1 bg-black">
        {/* Visual Overlays */}
        <div className="absolute inset-0 z-10 pointer-events-none" />

        {/* Camera Feed */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          autoPlay
          playsInline
          muted
        />

        {/* MediaPipe Skeleton Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-20"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* AI Posture Feedback Badge */}
        <div className="absolute bottom-6 left-6 z-30">
          {postureStatus === "correct" ? (
            <div className="flex items-center gap-2 bg-emerald-500/90 text-white px-4 py-2 rounded-full backdrop-blur-sm shadow-lg">
              <CheckCircle2 size={18} />
              Posture Correct
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-full backdrop-blur-sm shadow-lg">
              <AlertCircle size={18} />
              Adjust Your Form
            </div>
          )}
        </div>
      </div>

      {/* --- RIGHT SIDEBAR: SESSION DATA --- */}
      <div className="w-96 flex flex-col bg-white shadow-2xl overflow-y-auto">
        {/* Header Section */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-teal-500 uppercase tracking-widest">
                Active Recovery
              </p>
              <h1 className="text-2xl font-bold text-slate-800 mt-1">
                {exerciseData.name}
              </h1>
            </div>
            <button
              onClick={() => navigate("/patient")}
              className="p-2 -mr-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Stats and Info */}
        <div className="p-6 space-y-6 flex-1">
          {/* Reps and Sets Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
                Set
              </p>
              <p className="text-4xl font-black text-slate-800">
                {currentSet}
                <span className="text-2xl text-slate-400">
                  /{prescription.sets}
                </span>
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
                Reps
              </p>
              <p className="text-4xl font-black text-slate-800">
                {reps}
                <span className="text-2xl text-slate-400">
                  /{prescription.repsPerSet}
                </span>
              </p>
            </div>
          </div>

          {/* Completed Sets Summary */}
          {completedSets.length > 0 && (
            <div className="bg-emerald-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">
                Completed Sets
              </p>
              <div className="space-y-1">
                {completedSets.map((s) => (
                  <div
                    key={s.setNumber}
                    className="flex justify-between text-sm text-emerald-800"
                  >
                    <span>Set {s.setNumber}</span>
                    <span>
                      {s.performedReps} reps · {s.accuracy}% accuracy
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Large Timer Display */}
          <div className="text-center">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
              Total Session Time
            </p>
            <p className="text-5xl font-black text-slate-800 tabular-nums">
              {formatTime(timer)}
            </p>
          </div>

          {/* Exercise Details */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">
              Clinical Description
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              {exerciseData.description ||
                "Maintain controlled movements as prescribed by your therapist."}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 space-y-3">
          {allSetsDone ? (
            /* All sets done — only show Finish */
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-lg font-bold py-5 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <CheckCircle2 size={22} />
              {isSubmitting ? "Saving..." : "Finish Session"}
            </button>
          ) : !isActive ? (
            <button
              onClick={() => setIsActive(true)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold py-5 rounded-2xl shadow-lg shadow-teal-100 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Play size={22} />
              {reps > 0 ? "Resume Set" : "Start Exercise"}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setIsActive(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-5 rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <Pause size={18} />
                Pause
              </button>
              <button
                onClick={handleManualSetComplete}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-5 rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Complete Set
              </button>
            </div>
          )}

          {/* Finish early is always available while session is in progress */}
          {!allSetsDone && (
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-600 font-semibold py-3 rounded-2xl transition-colors"
            >
              {isSubmitting ? "Saving..." : "Finish Session Early"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseSession;