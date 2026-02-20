import { useState, useEffect, useRef } from "react";
import {
  X,
  RefreshCcw,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { usePose } from "../hooks/usePose";
import wsService from "../services/websocket.service";
import { useGoogleFit } from "../hooks/useGoogleFit";
import ReactionExercise from "../components/ReactionExercise";

const ExerciseSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('id');
  const tolerance = Number(searchParams.get('tolerance') ?? 0);

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  /* ---------------- POSE HOOK ---------------- */
  const isReaction = assignment?.exercise?.name === 'Reaction Exercise';

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

  usePose({
    videoRef,
    canvasRef,
    isActive: isActive && !isReaction,
    tolerance,
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
        // Use server's recorded startTime so the Google Fit query window
        // matches exactly what the server stored (avoids client/server clock drift)
        setSessionStartTime(new Date(data.session.startTime));
        
        console.log('Session started:', data);
        console.log('Session mode set to:', data.session.mode);
        console.log('Current state - smartwatchEnabled:', smartwatchEnabled, 'sessionMode:', data.session.mode);
        
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
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        const data = await response.json();
        setIsActive(false);
        
        if (smartwatchEnabled && wsConnected) {
          wsService.endSession(sessionId);
        }
        
        // Fetch historical data if smartwatch was enabled
        if (smartwatchEnabled && sessionStartTime && sessionMode === 'tracked') {
          setTimeout(async () => {
            try {
              // Add ±5 min buffer around the session window so that any
              // Google Fit data synced slightly before/after is captured
              const bufferMs = 5 * 60 * 1000;
              const queryStart = new Date(sessionStartTime.getTime() - bufferMs);
              const queryEnd   = new Date(endTime.getTime()   + bufferMs);
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
          }, 2000); // Wait 2 seconds for Google Fit to sync
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
              className={`flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-all duration-300 ${
                postureStatus === "correct"
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
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

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs">
                  i
                </span>
                Instructions
              </h3>
              
              {/* Google Fit Status Badge */}
              {isActive ? (
                // Show actual session mode when session is active
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
                // Show predicted mode before session starts
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
