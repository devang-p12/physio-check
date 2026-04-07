import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  RefreshCcw,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as faceapi from "face-api.js";

import { usePose } from "../hooks/usePose";
import { useHands } from "../hooks/useHands";
import { tts } from "../utils/tts";
import wsService from "../services/websocket.service";
import { useGoogleFit } from "../hooks/useGoogleFit";
import ReactionExercise from "../components/ReactionExercise";

// Emotions considered strain indicators
const STRAIN_EMOTIONS = ["angry", "sad", "fearful", "disgusted"];

// Emoji map for display
const EMOTION_EMOJI: Record<string, string> = {
  happy: "😊",
  neutral: "😐",
  surprised: "😮",
  angry: "😠",
  sad: "😢",
  fearful: "😨",
  disgusted: "🤢",
};

// Vector Diagram Mapping
const EXERCISE_IMAGES: Record<string, string> = {
  'Knee Extension': '/images/exercises/knee_extension_demo.png',
  'Shoulder Abduction': '/images/exercises/shoulder_abduction_demo.png',
  'Hip Hinge': '/images/exercises/hip_hinge_demo.png',
  'Calf Raise': '/images/exercises/calf_raise_demo.png',
  'Lateral Leg Raise': '/images/exercises/lateral_raise_demo.png',
  'Knee Flexion': '/images/exercises/knee_flexion_demo.png',
  'Shoulder Flexion': '/images/exercises/shoulder_flex_demo.png',
  'Side Bend': '/images/exercises/side_bend_demo.png',
  'Single Leg Balance': '/images/exercises/single_balance_demo.png',
  'Elbow Flexion': '/images/exercises/elbow_flexion_demo.png',
};

const ExerciseSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('id');

  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionMode, setSessionMode] = useState<'tracked' | 'manual'>('manual');
  const [reps, setReps] = useState(0);
  const [postureStatus, setPostureStatus] =
    useState<"correct" | "incorrect">("correct");
  const [formCue, setFormCue] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [reactionHits, setReactionHits] = useState(0);
  const [reactionTimeLeft, setReactionTimeLeft] = useState(0);

  // ── Emotion state ──────────────────────────────────────────────────────────
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Emotion / audio refs ───────────────────────────────────────────────────
  const emotionModelLoaded = useRef(false);
  const lastAudioTimeRef = useRef(0);
  const frameCounterRef = useRef(0);
  const emotionLoopRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  // Keep isActiveRef in sync
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const { isConnected: googleFitConnected, connect: connectGoogleFit } = useGoogleFit();
  const [wsConnected, setWsConnected] = useState(false);
  const [smartwatchEnabled, setSmartwatchEnabled] = useState(false);
  const [predictedMode, setPredictedMode] = useState<'tracked' | 'manual'>('manual');

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    let interval: number | undefined;

    if (isActive) {
      interval = window.setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  /* ---------------- LOAD EMOTION MODELS ---------------- */
  useEffect(() => {
    const loadEmotionModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        emotionModelLoaded.current = true;
        console.log("Emotion models loaded");
      } catch (err) {
        console.error("Emotion model load failed", err);
      }
    };
    loadEmotionModels();
  }, []);

  /* ---------------- AUDIO WARNING ---------------- */
  const triggerAudioWarning = useCallback(() => {
    const now = Date.now();
    if (now - lastAudioTimeRef.current < 8000) return; // 8 s cooldown
    lastAudioTimeRef.current = now;
    tts.speak("Please do not pressure yourself. Take it slow.");
  }, []);

  /* ---------------- EMOTION DETECTION LOOP ---------------- */
  // Runs independently of the pose loop — polls every ~500 ms when session active
  const runEmotionLoop = useCallback(async () => {
    if (!emotionModelLoaded.current || !videoRef.current) return;
    if (!isActiveRef.current) return;

    frameCounterRef.current++;

    // Only run detection every 5 ticks (~2.5 s effective interval to keep CPU low)
    if (frameCounterRef.current % 5 === 0) {
      try {
        const video = videoRef.current;
        if (video.readyState >= 2) {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          if (detection?.expressions) {
            const dominantEmotion = Object.entries(detection.expressions as any)
              .sort((a: any, b: any) => b[1] - a[1])[0][0];
            setDetectedEmotion(dominantEmotion);

            const { angry, sad, fearful } = detection.expressions as any;
            const strainScore = (angry ?? 0) + (sad ?? 0) + (fearful ?? 0);

            if (strainScore > 0.8) {
              triggerAudioWarning();
            }
          }
        }
      } catch (err) {
        console.warn("Emotion detection error", err);
      }
    }

    // Schedule next tick in 500 ms
    emotionLoopRef.current = window.setTimeout(runEmotionLoop, 500);
  }, [triggerAudioWarning]);

  // Start / stop emotion loop with session state
  useEffect(() => {
    if (isActive) {
      frameCounterRef.current = 0;
      lastAudioTimeRef.current = 0;
      emotionLoopRef.current = window.setTimeout(runEmotionLoop, 500);
    } else {
      if (emotionLoopRef.current) {
        clearTimeout(emotionLoopRef.current);
        emotionLoopRef.current = null;
      }
      setDetectedEmotion(null);
      tts.cancel();
    }

    return () => {
      if (emotionLoopRef.current) {
        clearTimeout(emotionLoopRef.current);
        emotionLoopRef.current = null;
      }
    };
  }, [isActive, runEmotionLoop]);

  /* ---------------- SMARTWATCH SETTINGS ---------------- */
  useEffect(() => {
    checkSmartwatchSettings();

    const token = localStorage.getItem('token');
    if (token && smartwatchEnabled) {
      wsService.connect(token);
    }

    wsService.on('connected', () => setWsConnected(true));
    wsService.on('disconnected', () => setWsConnected(false));
    wsService.on('sensor_data_ack', (data: any) => {
      console.log('Sensor data acknowledged:', data);
    });

    return () => {
      if (smartwatchEnabled) {
        wsService.disconnect();
      }
    };
  }, [smartwatchEnabled]);

  const checkSmartwatchSettings = async () => {
    try {
      const response = await fetch('http://localhost:5000/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const enabled = data.settings.smartwatchEnabled;
        const connected = data.googleFit.connected;

        setSmartwatchEnabled(enabled);
        setPredictedMode(enabled && connected ? 'tracked' : 'manual');

        console.log('Settings check:', {
          smartwatchEnabled: enabled,
          googleFitConnected: connected,
          predictedMode: enabled && connected ? 'tracked' : 'manual'
        });
      }
    } catch (error) {
      console.error('Error checking smartwatch settings:', error);
      setSmartwatchEnabled(false);
      setPredictedMode('manual');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  /* ---------------- POSE HOOK & HAND HOOK SELECTION --------------- */
  const isReaction = assignment?.exercise?.name === 'Reaction Exercise';
  const isPalmExercise = assignment?.exercise?.name?.toLowerCase().includes('palm');
  const useHandTracking = isPalmExercise;

  useEffect(() => {
    if (!assignmentId) return;
    const fetchAssignment = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/patient/assignment/${assignmentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAssignment(data.assignment);
        } else {
          console.warn('Failed to fetch assignment', await res.text());
        }
      } catch (err) {
        console.error('Error fetching assignment:', err);
      }
    };
    fetchAssignment();
  }, [assignmentId]);

  // Use hand tracking for palm exercises, pose tracking for body exercises
  // NOTE: Hooks must always be called unconditionally! We pass isActive=false to disable the unused one
  useHands({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    isActive: useHandTracking && isActive && !isReaction,
    tolerances: assignment?.prescription ? (typeof assignment.prescription === 'string' ? JSON.parse(assignment.prescription).tolerances : assignment.prescription.tolerances) : [],
    exerciseName: assignment?.exercise?.name,
    onRepUpdate: setReps,
    onPostureUpdate: setPostureStatus,
    onCueUpdate: setFormCue,
  });

  usePose({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    isActive: !useHandTracking && isActive && !isReaction,
    tolerances: assignment?.prescription ? (typeof assignment.prescription === 'string' ? JSON.parse(assignment.prescription).tolerances : assignment.prescription.tolerances) : [],
    exerciseName: assignment?.exercise?.name,
    onRepUpdate: setReps,
    onPostureUpdate: setPostureStatus,
    onCueUpdate: setFormCue,
  });

  /* ---------------- SESSION HANDLERS ---------------- */
  const handleStartSession = async () => {
    if (!assignmentId) {
      alert('No assignment ID found');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assignmentId })
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session.id);
        setSessionMode(data.session.mode);
        setIsActive(true);
        setSessionStartTime(new Date(data.session.startTime));

        console.log('Session started:', data);

        if (data.warnings && data.warnings.length > 0) {
          console.warn('Session warnings:', data.warnings);
        }

        if (smartwatchEnabled && wsConnected) {
          wsService.startSession(data.session.id);
        }
      } else {
        const error = await response.json();
        console.error('Failed to start session:', error);
        alert(`Failed to start session: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session');
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      alert('No active session found');
      return;
    }

    const endTime = new Date();
    setSessionEndTime(endTime);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/session/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          reps
        })
      });

      if (response.ok) {
        const data = await response.json();
        setIsActive(false);

        if (smartwatchEnabled && wsConnected) {
          wsService.endSession(sessionId);
        }

        if (smartwatchEnabled && sessionStartTime && sessionMode === 'tracked') {
          setTimeout(async () => {
            try {
              const bufferMs = 5 * 60 * 1000;
              const queryStart = new Date(sessionStartTime.getTime() - bufferMs);
              const queryEnd = new Date(endTime.getTime() + bufferMs);
              const historyResponse = await fetch(
                `http://localhost:5000/google-fit/history?startTime=${queryStart.toISOString()}&endTime=${queryEnd.toISOString()}`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                }
              );

              if (historyResponse.ok) {
                const historyData = await historyResponse.json();
                alert(
                  `Session completed!\n\n` +
                  `Reps: ${reps}\n` +
                  `Duration: ${formatTime(timer)}\n\n` +
                  `Heart Rate: ${historyData.avgHeartRate || 'N/A'} bpm (avg)\n` +
                  `Calories: ${Math.round(historyData.totalCalories || 0)}`
                );
              } else {
                alert(`Session completed!\n\nReps: ${reps}\nDuration: ${formatTime(timer)}`);
              }
            } catch (error) {
              console.error('Error fetching historical data:', error);
              alert(`Session completed!\n\nReps: ${reps}\nDuration: ${formatTime(timer)}`);
            }

            navigate('/patient');
          }, 2000);
        } else {
          alert(`Session completed!\n\nReps: ${reps}\nDuration: ${formatTime(timer)}`);
          navigate('/patient');
        }
      } else {
        const error = await response.json();
        console.error('Failed to complete session:', error);
        alert(`Failed to complete session: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session');
    }
  };

  // Derived helpers
  const isStrain = detectedEmotion ? STRAIN_EMOTIONS.includes(detectedEmotion) : false;

  return (
    <div className="h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* --- LEFT AREA: LIVE CAMERA FEED --- */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-900/10 z-10" />

        {/* CAMERA */}
        {!isReaction ? (
          <>
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
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10 pointer-events-none"
            />
          </>
        ) : (
          <div className="p-6">
            <ReactionExercise
              duration={assignment?.exercise?.duration ?? 30}
              targets={assignment?.prescription?.repsPerSet ?? 10}
              isActive={isActive}
              onHitsChange={setReactionHits}
              onTimeChange={setReactionTimeLeft}
              onComplete={(score) => {
                console.log('Reaction exercise complete', score);
                setReactionHits(score.hits);
              }}
            />
          </div>
        )}

        {/* Live Feedback Overlay - only for non-reaction exercises */}
        {!isReaction && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
            <div
              className={`flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-all duration-300 ${postureStatus === "correct"
                ? "bg-teal-500/20 border-teal-400/50 text-teal-300"
                : "bg-red-500/20 border-red-400/50 text-red-300"
                }`}
            >
              {postureStatus === "correct" ? (
                <>
                  <CheckCircle2 size={24} fill="currentColor" />
                  <span className="font-bold tracking-wide">Posture Correct</span>
                </>
              ) : (
                <>
                  <AlertCircle size={24} fill="currentColor" />
                  <span className="font-bold tracking-wide uppercase">
                    {formCue ?? "Check your form"}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Emotion badge — top-right of camera feed ── */}
        {isActive && detectedEmotion && (
          <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold backdrop-blur-sm border transition-all ${isStrain
              ? "bg-red-500/20 border-red-500/40 text-red-300"
              : "bg-slate-800/80 border-slate-700 text-slate-300"
            }`}>
            <span className="text-lg leading-none">{EMOTION_EMOJI[detectedEmotion] ?? "😐"}</span>
            <span className="capitalize">{detectedEmotion}</span>
            {isStrain && (
              <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold">Strain</span>
            )}
          </div>
        )}
      </div>

      {/* --- RIGHT SIDEBAR --- */}
      <div className="w-full md:w-[400px] bg-white flex flex-col h-1/2 md:h-full relative z-30 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1 block">
              {assignment?.exercise?.description ? assignment.exercise.description.split(' ')[0] : 'Exercise'}
            </span>
            <h1 className="text-2xl font-bold text-slate-900">{assignment?.exercise?.name ?? 'Exercise'}</h1>
          </div>
          <button
            onClick={() => navigate("/patient")}
            className="p-2 -mr-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {isReaction ? (
              <>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Hits</span>
                  <div className="text-4xl font-bold text-slate-900 mt-1">
                    {reactionHits}
                    <span className="text-sm text-slate-400 font-medium"> / {assignment?.prescription?.repsPerSet ?? 10}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Time Left</span>
                  <div className="text-4xl font-bold text-slate-900 mt-1 tabular-nums">
                    {reactionTimeLeft > 0 ? `${reactionTimeLeft}s` : `${assignment?.exercise?.duration ?? 30}s`}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Reps</span>
                  <div className="text-4xl font-bold text-slate-900 mt-1">
                    {reps}
                    <span className="text-sm text-slate-400 font-medium"> / {assignment?.prescription?.repsPerSet ?? 15}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Duration</span>
                  <div className="text-4xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatTime(timer)}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Expression card (sidebar) ── */}
          {isActive && detectedEmotion && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between border transition-all ${isStrain
                ? "bg-red-50 border-red-200"
                : "bg-slate-50 border-slate-200"
              }`}>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-0.5">
                  Expression
                </p>
                <p className={`font-semibold capitalize text-sm ${isStrain ? "text-red-600" : "text-emerald-600"}`}>
                  {detectedEmotion}
                </p>
                {isStrain && (
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-0.5">
                    Strain detected
                  </p>
                )}
              </div>
              <span className="text-3xl">{EMOTION_EMOJI[detectedEmotion] ?? "😐"}</span>
            </div>
          )}

          {/* Instructions */}
          <div>
            {EXERCISE_IMAGES[assignment?.exercise?.name] && (
              <div className="mb-6 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-center items-center shadow-inner">
                <img 
                  src={EXERCISE_IMAGES[assignment?.exercise?.name]} 
                  alt={assignment?.exercise?.name} 
                  className="max-w-full h-auto max-h-[300px] object-contain"
                />
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs">
                  i
                </span>
                Instructions
              </h3>

              {/* Google Fit Status Badge */}
              {isActive ? (
                smartwatchEnabled && sessionMode === 'tracked' ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full border border-green-300">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-green-700">Google Fit Enabled</span>
                  </div>
                ) : smartwatchEnabled && sessionMode === 'manual' ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 rounded-full border border-yellow-300">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-xs font-bold text-yellow-700">Manual Mode</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-300">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    <span className="text-xs font-bold text-slate-600">Tracking Off</span>
                  </div>
                )
              ) : (
                smartwatchEnabled && predictedMode === 'tracked' ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full border border-green-300">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs font-bold text-green-700">Google Fit</span>
                  </div>
                ) : smartwatchEnabled ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 rounded-full border border-yellow-300">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-xs font-bold text-yellow-700">Manual Mode</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-300">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    <span className="text-xs font-bold text-slate-600">Tracking Off</span>
                  </div>
                )
              )}
            </div>
            <ul className="space-y-4">
              {(isReaction ? [
                "Allow camera access when prompted.",
                "Hold your hand up so the camera can see it clearly.",
                "Point your index finger at the blue circles to hit them.",
                "Try to hit all targets before the timer runs out!",
              ] : [
                "Stand with feet shoulder-width apart.",
                "Keep your back straight and chest up.",
                "Lower hips until thighs are parallel to floor.",
                "Push through heels to return to start.",
              ]).map((step, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
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
              {isReaction
                ? 'Keep your arm raised at a comfortable height. Move steadily — quick precise movements beat frantic waving!'
                : "Ensure your knees don't go past your toes to avoid injury."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white">
          {!isActive ? (
            <button
              onClick={handleStartSession}
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
              <button
                onClick={handleEndSession}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg"
              >
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