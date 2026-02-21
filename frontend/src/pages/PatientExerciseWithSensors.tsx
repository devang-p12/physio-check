import { useState, useEffect, useRef } from "react";
import {
  X,
  Maximize2,
  RefreshCcw,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Video,
  Heart,
  Activity,
  TrendingUp,
  Link as LinkIcon
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGoogleFit } from "../hooks/useGoogleFit";

const ExerciseSessionWithSensors = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('id');
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionMode, setSessionMode] = useState<'tracked' | 'manual'>('manual');
  const [reps, setReps] = useState(0);
  const [postureStatus, setPostureStatus] = useState("correct");
  const [timer, setTimer] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const { isConnected: googleFitConnected, connect: connectGoogleFit } = useGoogleFit();
  const [smartwatchEnabled, setSmartwatchEnabled] = useState(false);

  // Check smartwatch settings on mount
  useEffect(() => {
    checkSmartwatchSettings();
  }, []);

  // Check smartwatch settings
  const checkSmartwatchSettings = async () => {
    try {
      const response = await fetch('http://localhost:5000/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSmartwatchEnabled(data.settings.smartwatchEnabled);
      }
    } catch (error) {
      console.error('Error checking smartwatch settings:', error);
      setSmartwatchEnabled(false);
    }
  };

  // Timer Logic
  useEffect(() => {
    let interval: number | null = null;
    if (isActive) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
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

  const handleStartSession = async () => {
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
        // Use server's recorded startTime to avoid client/server clock drift
        setSessionStartTime(new Date(data.session.startTime));
        
        // Show warning if in manual mode
        if (data.warnings && data.warnings.length > 0) {
          console.warn('Session warnings:', data.warnings);
        }
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session');
    }
  };

  const handleEndSession = async () => {
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
        
        alert('Session completed! View details in Session History.');
        navigate('/patient');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session');
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* --- LEFT AREA: LIVE CAMERA FEED --- */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-900/10 z-10"></div>

        {/* Simulated AI Skeleton Overlay */}
        <div className="absolute inset-0 z-0 opacity-20">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: "radial-gradient(#14B8A6 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          ></div>
        </div>

        {/* Patient Silhouette */}
        <div className="relative z-0 opacity-50 animate-pulse">
          <svg
            width="300"
            height="500"
            viewBox="0 0 100 200"
            fill="none"
            stroke={postureStatus === "correct" ? "#14B8A6" : "#EF4444"}
            strokeWidth="2"
          >
            <circle cx="50" cy="20" r="15" />
            <line x1="50" y1="35" x2="50" y2="100" />
            <line x1="50" y1="50" x2="20" y2="80" />
            <line x1="50" y1="50" x2="80" y2="80" />
            <line x1="50" y1="100" x2="30" y2="180" />
            <line x1="50" y1="100" x2="70" y2="180" />
          </svg>
        </div>

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
                <CheckCircle2
                  size={24}
                  fill="currentColor"
                  className="text-teal-500"
                />
                <span className="font-bold tracking-wide">Posture Correct</span>
              </>
            ) : (
              <>
                <AlertCircle
                  size={24}
                  fill="currentColor"
                  className="text-red-500"
                />
                <span className="font-bold tracking-wide">
                  Straighten Back!
                </span>
              </>
            )}
          </div>
        </div>



        {/* Tracking Status */}
        {smartwatchEnabled && sessionMode === 'tracked' && (
          <div className="absolute top-6 left-6 z-20">
            <div className="px-6 py-4 bg-green-500/20 backdrop-blur-sm rounded-lg border border-green-400/50">
              <p className="text-green-300 text-sm font-medium">✓ Tracked Mode</p>
              <p className="text-green-200/80 text-xs mt-1">Data will be synced from Google Fit</p>
            </div>
          </div>
        )}



        {/* Camera Controls */}
        <div className="absolute bottom-6 left-6 z-20 flex gap-4">
          <button className="p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-all border border-white/10">
            <Video size={20} />
          </button>
          <button className="p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-all border border-white/10">
            <Maximize2 size={20} />
          </button>
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
          
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Real-time Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <span className="text-xs text-slate-500 font-bold uppercase">
                Reps
              </span>
              <div className="text-4xl font-bold text-slate-900 mt-1">
                {reps}{" "}
                <span className="text-sm text-slate-400 font-medium">/ 15</span>
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

          {/* Google Fit Connection */}
          {!googleFitConnected && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h4 className="font-bold text-blue-900 text-sm mb-2">Connect Smartwatch</h4>
              <p className="text-xs text-blue-700 mb-3">
                Connect your Google Fit to track detailed health metrics
              </p>
              <button
                onClick={connectGoogleFit}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-2 rounded-lg transition-colors"
              >
                Connect Google Fit
              </button>
            </div>
          )}

          

          {/* Instructions */}
          <div>
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs">
                i
              </span>
              Instructions             {googleFitConnected && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-400/50 text-blue-800 text-xs">
              <LinkIcon size={12} />
              Google Fit
            </div>
            )}
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

          {/* Posture Tips */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-900 text-sm mb-2">💡 Pro Tip</h4>
            <p className="text-xs text-blue-700">
              Ensure your knees don't go past your toes to avoid injury. The AI
              will alert you if you lean too far forward.
            </p>

          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {!isActive ? (
            <button
              onClick={handleStartSession}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Play size={24} fill="currentColor" />
              Start Session
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setIsActive(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Pause size={20} fill="currentColor" />
                Pause
              </button>
              <button
                onClick={() => setReps(0)}
                className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-colors"
              >
                <RefreshCcw size={20} />
              </button>
              <button 
                onClick={handleEndSession}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
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

export default ExerciseSessionWithSensors;
