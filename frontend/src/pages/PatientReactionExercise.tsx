import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Hands } from '@mediapipe/hands';
import type { Results as HandResults } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

/* ─── types ─── */
type Target = { id: number; x: number; y: number; r: number; hit: boolean };

function makeTargets(count: number): Target[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: 0.08 + Math.random() * 0.84,
    y: 0.12 + Math.random() * 0.76,
    r: 0.055 + Math.random() * 0.04,
    hit: false,
  }));
}

/* ─── component ─── */
export default function PatientReactionExercise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('id');

  /* assignment meta */
  const [assignment, setAssignment] = useState<any>(null);
  const duration = assignment?.exercise?.duration ?? 30;
  const targetCount = assignment?.prescription?.repsPerSet ?? 10;

  /* session */
  const [sessionId, setSessionId] = useState<string | null>(null);

  /* game state */
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'loading' | 'running' | 'done'>('idle');

  /* refs shared with RAF / MediaPipe closure */
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const targetsRef  = useRef<Target[]>([]);
  const hitsRef     = useRef(0);
  const cameraRef   = useRef<Camera | null>(null);
  const handsRef    = useRef<Hands | null>(null);
  const rafRef      = useRef(0);
  const runningRef  = useRef(false);

  /* ── fetch assignment ─────────────────────────────────────── */
  useEffect(() => {
    if (!assignmentId) return;
    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/patient/assignment/${assignmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAssignment(d.assignment); })
      .catch(console.error);
  }, [assignmentId]);

  /* ── start backend session ────────────────────────────────── */
  const handleStartSession = async () => {
    if (!assignmentId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) { alert('Failed to start session'); return; }
      const { session } = await res.json();
      setSessionId(session.id);
      startGame();
    } catch { alert('Failed to start session'); }
  };

  /* ── end backend session ──────────────────────────────────── */
  const handleEndSession = (_finalHits: number) => {
    stopGame();                          // stop camera & Hands before navigating
    if (sessionId) {
      // fire-and-forget — don't await so navigation is instant
      const token = localStorage.getItem('token');
      fetch('http://localhost:5000/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    navigate('/patient');
  };

  /* ── game engine ──────────────────────────────────────────── */
  const startGame = () => {
    const fresh = makeTargets(targetCount);
    targetsRef.current = fresh;
    hitsRef.current = 0;
    setHits(0);
    setTimeLeft(duration);
    setGameState('loading');
    runningRef.current = true;

    const hands = new Hands({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
    });
    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    const endAt = Date.now() + duration * 1000;

    hands.onResults((results: HandResults) => {
      if (!runningRef.current) return;
      const canvas = canvasRef.current;
      const video  = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d')!;

      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width;
      canvas.height = rect.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;

      /* ── object-cover coordinate mapping ─────────────────────────
         MediaPipe normalises to the intrinsic video frame.
         CSS object-cover fits the larger dimension and crops the rest,
         so we must map landmarks into the same sub-rect that's visible. */
      const vAR = (video.videoWidth || 1280) / (video.videoHeight || 720);
      const cAR = W / H;
      let displayW: number, displayH: number, xOff: number, yOff: number;
      if (cAR > vAR) {          // container wider → fit by width, crop top/bottom
        displayW = W; displayH = W / vAR;
        xOff = 0;              yOff = (H - displayH) / 2;
      } else {                  // container taller → fit by height, crop left/right
        displayH = H; displayW = H * vAR;
        xOff = (W - displayW) / 2; yOff = 0;
      }
      /* helper: landmark (0-1, already mirrored) → canvas px */
      const lx = (nx: number) => xOff + nx * displayW;
      const ly = (ny: number) => yOff + ny * displayH;

      /* draw only the current (first unhit) target
         Targets live in plain canvas-space (0..W, 0..H) — NOT video coords */
      const active = targetsRef.current.find(t => !t.hit);
      if (active) {
        const cx = (1 - active.x) * W;   // mirror X; spans full canvas
        const cy = active.y * H;
        const r  = active.r * Math.min(W, H);
        /* glow */
        const g = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.4);
        g.addColorStop(0, 'rgba(59,130,246,0.9)');
        g.addColorStop(1, 'rgba(59,130,246,0)');
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        /* solid */
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59,130,246,0.88)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.stroke();
        /* + symbol */
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(r * 1.3)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', cx, cy);
      }

      /* draw fingertip */
      const lms = results.multiHandLandmarks?.[0];
      if (lms) {
        const tip = lms[8];              // index fingertip
        const fx = lx(1 - tip.x);       // mirror
        const fy = ly(tip.y);

        /* small precise dot — no large ring so it doesn't obscure targets */
        ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'white'; ctx.fill();
        ctx.beginPath(); ctx.arc(fx, fy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();

        /* hit detection — target in canvas-space, fingertip in cover-mapped space,
           both are now in the same canvas pixel space */
        const activeTarget = targetsRef.current.find(t => !t.hit);
        if (activeTarget) {
          const tcx = (1 - activeTarget.x) * W;
          const tcy = activeTarget.y * H;
          const hitRadius = activeTarget.r * Math.min(W, H) + 10;
          if (Math.hypot(tcx - fx, tcy - fy) < hitRadius) {
            hitsRef.current += 1;
            targetsRef.current = targetsRef.current.map(t =>
              t.id === activeTarget.id ? { ...t, hit: true } : t
            );
            setHits(hitsRef.current);
          }
        }
      }
    });

    /* camera */
    const camera = new Camera(videoRef.current!, {
      onFrame: async () => {
        if (handsRef.current) await handsRef.current.send({ image: videoRef.current! });
      },
      width: 1280,
      height: 720,
    });
    cameraRef.current = camera;
    camera.start().then(() => setGameState('running'));

    /* ticker */
    const tick = () => {
      if (!runningRef.current) return;
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (Date.now() >= endAt || targetsRef.current.every(t => t.hit)) {
        finishGame();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const finishGame = () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    cameraRef.current?.stop();
    handsRef.current?.close();
    cameraRef.current = null;
    handsRef.current = null;
    setTimeLeft(0);
    setGameState('done');
  };

  const stopGame = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    cameraRef.current?.stop();
    handsRef.current?.close();
    cameraRef.current = null;
    handsRef.current = null;
    setGameState('idle');
  };

  useEffect(() => () => stopGame(), []);

  /* ─── render ───────────────────────────────────────────────── */
  return (
    <div className="h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">

      {/* ── LEFT: game area ── */}
      <div className="flex-1 relative bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          autoPlay muted playsInline
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

        {/* loading overlay */}
        {gameState === 'loading' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
            <div className="w-12 h-12 border-4 border-white/20 border-t-teal-400 rounded-full animate-spin mb-5" />
            <p className="text-white font-semibold text-lg">Starting camera…</p>
            <p className="text-white/50 text-sm mt-1">Please allow camera access if prompted</p>
          </div>
        )}

        {/* idle / pre-start overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60">
            <div className="text-center px-10">
              <div className="text-7xl mb-5">👆</div>
              <h2 className="text-3xl font-bold text-white mb-2">Reaction Exercise</h2>
              <p className="text-white/70 text-sm mb-1">{targetCount} targets · {duration}s</p>
              <p className="text-white/50 text-sm mt-3">
                Press <span className="text-teal-400 font-bold">Start Session</span> on the right, then point<br />
                your index finger at the blue circles to hit them!
              </p>
            </div>
          </div>
        )}

        {/* done overlay */}
        {gameState === 'done' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75">
            <div className="text-center px-10">
              <div className="text-7xl mb-5">🎯</div>
              <h2 className="text-3xl font-bold text-white mb-2">Round Complete!</h2>
              <p className="text-white/80 text-xl">
                {hitsRef.current} / {targetCount} targets hit
              </p>
              <p className="text-teal-400 font-bold text-4xl mt-3">
                {Math.round((hitsRef.current / targetCount) * 100)}%
              </p>
              <p className="text-white/40 text-sm mt-5">
                Press <span className="text-white/80 font-semibold">Finish</span> on the right to save your session.
              </p>
            </div>
          </div>
        )}

        {/* live timer badge */}
        {gameState === 'running' && (
          <div className="absolute top-5 right-5 z-20 bg-black/60 backdrop-blur-sm rounded-2xl px-5 py-2.5 text-white font-mono font-bold text-2xl">
            {timeLeft}s
          </div>
        )}

        {/* hits badge */}
        {(gameState === 'running') && (
          <div className="absolute top-5 left-5 z-20 bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-white font-bold text-sm">
            {hits} / {targetCount} hits
          </div>
        )}
      </div>

      {/* ── RIGHT: sidebar ── */}
      <div className="w-full md:w-[380px] bg-white flex flex-col shadow-2xl">

        {/* header */}
        <div className="p-6 border-b bg-slate-50 flex justify-between items-start">
          <div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-1">
              Reaction Training
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Reaction Exercise</h1>
          </div>
          <button
            onClick={() => { stopGame(); navigate('/patient'); }}
            className="p-2 -mr-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* stats */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl border p-4 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Hits</p>
              <p className="text-4xl font-bold text-slate-900">
                {hits}
                <span className="text-sm font-normal text-slate-400"> / {targetCount}</span>
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl border p-4 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                {gameState === 'done' ? 'Accuracy' : 'Time Left'}
              </p>
              <p className="text-4xl font-bold text-slate-900 tabular-nums">
                {gameState === 'done'
                  ? `${Math.round((hitsRef.current / targetCount) * 100)}%`
                  : gameState === 'running'
                    ? `${timeLeft}s`
                    : `${duration}s`}
              </p>
            </div>
          </div>

          {/* progress bar */}
          {(gameState === 'running' || gameState === 'done') && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Targets hit</span>
                <span>{Math.round((hits / targetCount) * 100)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((hits / targetCount) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* instructions */}
          <div>
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">i</span>
              How to play
            </h3>
            <ul className="space-y-3">
              {[
                'Allow camera access when prompted.',
                'Hold your hand up so the camera can see it clearly.',
                'Point your index finger at the blue ⊕ circles to hit them.',
                'Hit all targets before the timer runs out!',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-600">
                  <span className="font-bold text-slate-300 shrink-0">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <h4 className="font-bold text-purple-900 text-sm mb-1">💡 Tip</h4>
            <p className="text-xs text-purple-700">
              Move your arm steadily — smooth precise movements beat frantic waving!
              Keep your elbow slightly bent for best range.
            </p>
          </div>
        </div>

        {/* footer controls */}
        <div className="p-6 border-t bg-white">
          {gameState === 'idle' && (
            <button
              onClick={handleStartSession}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Play size={24} fill="currentColor" />
              Start Session
            </button>
          )}

          {(gameState === 'loading' || gameState === 'running') && (
            <div className="flex gap-3">
              <button
                onClick={() => { stopGame(); setSessionId(null); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Pause size={20} fill="currentColor" />
                Stop
              </button>
              <button
                onClick={() => { finishGame(); }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl"
              >
                Finish Early
              </button>
            </div>
          )}

          {gameState === 'done' && (
            <button
              onClick={() => handleEndSession(hitsRef.current)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={22} />
              Save & Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
