import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Play, StopCircle, ChevronLeft, Activity, Repeat2, Zap } from "lucide-react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import type { Results } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// ───────────────────────────────────────────────────────────────────────────────
interface NormLandmark { x: number; y: number; z: number; visibility: number; }
type NormFrame = NormLandmark[];

const FULL_BODY_IDX  = [11,12,13,14,15,16,23,24,25,26,27,28];
const UPPER_BODY_IDX = [11,12,13,14,15,16];
const LOWER_CHECK    = [23,24,25,26];

class PoseNormalizer {
  static isFullBody(lms: any[]): boolean {
    return LOWER_CHECK.filter(i => (lms[i]?.visibility ?? 0) > 0.3).length >= 2;
  }
  static normalize(lms: any[]): NormFrame | null {
    if (!lms || lms.length < 17) return null;
    const lS = lms[11], rS = lms[12];
    if ((lS.visibility ?? 1) < 0.3 || (rS.visibility ?? 1) < 0.3) return null;
    const cx = (lS.x + rS.x) / 2, cy = (lS.y + rS.y) / 2, cz = (lS.z + rS.z) / 2;
    const sw = Math.sqrt((lS.x-rS.x)**2 + (lS.y-rS.y)**2);
    if (sw < 0.01) return null;
    const idx = this.isFullBody(lms) ? FULL_BODY_IDX : UPPER_BODY_IDX;
    return idx.map(i => ({
      x: (lms[i].x - cx) / sw, y: (lms[i].y - cy) / sw, z: (lms[i].z - cz) / sw,
      visibility: lms[i].visibility ?? 1,
    }));
  }
}

class DTW {
  static frameDistance(a: NormFrame, b: NormFrame): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 1;
    let total = 0;
    for (let i = 0; i < n; i++)
      total += Math.sqrt((a[i].x-b[i].x)**2 + (a[i].y-b[i].y)**2 + (a[i].z-b[i].z)**2);
    return total / n;
  }
  static compute(s1: NormFrame[], s2: NormFrame[]): number {
    const n = s1.length, m = s2.length;
    const mat: number[][] = Array.from({length: n+1}, () => new Array(m+1).fill(Infinity));
    mat[0][0] = 0;
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++) {
        const cost = this.frameDistance(s1[i-1], s2[j-1]);
        mat[i][j] = cost + Math.min(mat[i-1][j], mat[i][j-1], mat[i-1][j-1]);
      }
    return mat[n][m] / (n + m);
  }
  static similarity(dist: number): number {
    const raw = Math.max(0, 100 * (1 - dist / 1.0));
    return raw > 50 ? Math.min(100, Math.round(raw * 1.2)) : Math.round(raw);
  }
}

interface LiveMatchResult { similarity: number; repCount: number; status: string; }

class LiveMatcher {
  private template: NormFrame[];
  private windowSize: number;
  private buffer: NormFrame[] = [];
  repCount = 0;
  private isCooldown = false;
  private readonly cooldownMs = 1500;
  private readonly repThreshold = 75;
  private lastSampleMs = 0;
  private readonly sampleIntervalMs = 100; // ≈ 10 fps, matching template extraction rate
  private _lastResult: LiveMatchResult | null = null;

  constructor(frames: NormFrame[]) {
    this.template = frames;
    this.windowSize = Math.round(frames.length * 1.5);
  }
  private smooth(frame: NormFrame): NormFrame {
    if (this.buffer.length === 0) return frame;
    const last = this.buffer[this.buffer.length - 1];
    return frame.map((lm, i) => ({
      x: lm.x * 0.7 + (last[i]?.x ?? lm.x) * 0.3,
      y: lm.y * 0.7 + (last[i]?.y ?? lm.y) * 0.3,
      z: lm.z * 0.7 + (last[i]?.z ?? lm.z) * 0.3,
      visibility: lm.visibility,
    }));
  }
  processFrame(frame: NormFrame | null): LiveMatchResult {
    if (!frame) return { similarity: 0, repCount: this.repCount, status: "Detecting body..." };
    const now = Date.now();
    if (now - this.lastSampleMs < this.sampleIntervalMs)
      return this._lastResult ?? { similarity: 0, repCount: this.repCount, status: "Preparing..." };
    this.lastSampleMs = now;
    this.buffer.push(this.smooth(frame));
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    if (this.buffer.length < Math.ceil(this.template.length * 0.5)) {
      const r = { similarity: 0, repCount: this.repCount, status: "Preparing..." };
      this._lastResult = r; return r;
    }
    const tLen = this.template.length;
    const slices = [
      this.buffer.slice(-tLen),
      this.buffer.slice(-Math.round(tLen * 0.8)),
      this.buffer.slice(-Math.round(tLen * 1.2)),
    ];
    let best = 0;
    for (const slice of slices) {
      if (slice.length < 5) continue;
      const s = DTW.similarity(DTW.compute(slice, this.template));
      if (s > best) best = s;
    }
    let status = "Perform Movement";
    if (best > this.repThreshold && !this.isCooldown) {
      this.repCount++;
      this.triggerCooldown();
      status = "✓ Rep Logged!";
    } else if (this.isCooldown) {
      status = "Rep logged — keep going";
    } else if (best > 40) {
      status = "Movement detected...";
    } else if (this.buffer.length >= tLen) {
      status = "Keep going";
    }
    const result = { similarity: best, repCount: this.repCount, status };
    this._lastResult = result;
    return result;
  }
  private triggerCooldown() {
    this.isCooldown = true;
    setTimeout(() => {
      this.isCooldown = false;
      this.buffer = this.buffer.slice(Math.round(this.buffer.length / 2));
    }, this.cooldownMs);
  }
  reset() {
    this.repCount = 0; this.buffer = []; this.isCooldown = false;
    this.lastSampleMs = 0; this._lastResult = null;
  }
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  frameCount: number;
  durationSeconds: number;
  frames: number[][][];  // frames[i][j] = [x,y,z,vis] — normalised sparse landmarks
}

const PatientCustomExercise: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("id");

  const [assignment, setAssignment] = useState<any>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [matchResult, setMatchResult] = useState<LiveMatchResult>({
    similarity: 0,
    repCount: 0,
    status: "Press Start to begin",
  });

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const poseRef    = useRef<Pose | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const animRef    = useRef<number | null>(null);
  const stopRef    = useRef(false);
  const matcherRef = useRef<LiveMatcher | null>(null);
  const templateFramesRef = useRef<any[][]>([]);
  const repCountRef = useRef(0);
  const timerRef   = useRef<number | null>(null);

  // ── Load assignment + template ────────────────────────────────────────────
  useEffect(() => {
    if (!assignmentId) { setError("No assignment ID"); setLoadingData(false); return; }
    const token = localStorage.getItem("token");

    const load = async () => {
      try {
        // 1. Get assignment (which has customTemplateId)
        const assignRes = await fetch(`http://localhost:5000/patient/assignment/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!assignRes.ok) throw new Error("Failed to load assignment");
        const assignData = await assignRes.json();
        const assign = assignData.assignment;
        setAssignment(assign);

        const tmplId = assign.customTemplateId;
        if (!tmplId) throw new Error("This assignment does not have a custom exercise template");

        // 2. Get full template with frames
        const tmplRes = await fetch(`http://localhost:5000/patient/custom-template/${tmplId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tmplRes.ok) throw new Error("Failed to load exercise template");
        const tmplData = await tmplRes.json();
        setTemplate(tmplData.template);

        // 3. Deserialise frames (33 landmarks per frame) and init TemplateMatcher
        const normFrames = tmplData.template.frames.map((f: number[][]) =>
          f.map(([x, y, z, v]) => ({ x, y, z, visibility: v ?? 1 }))
        );
        templateFramesRef.current = normFrames;
        matcherRef.current = new LiveMatcher(normFrames);
      } catch (e: any) {
        setError(e.message ?? "Unknown error");
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [assignmentId]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  // ── MediaPipe setup ───────────────────────────────────────────────────────
  const initPose = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    pose.onResults((results: Results) => {
      canvas.width  = videoRef.current!.videoWidth  || 640;
      canvas.height = videoRef.current!.videoHeight || 480;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        const norm = PoseNormalizer.normalize(results.poseLandmarks as any);
        if (norm && matcherRef.current) {
          const res = matcherRef.current.processFrame(norm);
          repCountRef.current = res.repCount;
          setMatchResult({ similarity: res.similarity, repCount: res.repCount, status: res.status });
          const col = res.similarity >= 75 ? "#10b981" : res.similarity >= 45 ? "#f59e0b" : "#94a3b8";
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: col, lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
        } else {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#00e5cc", lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
        }
      }
      ctx.restore();
    });

    await pose.initialize();
    poseRef.current = pose;
    stopRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const sendLoop = async () => {
        if (stopRef.current) return;
        if (videoRef.current && videoRef.current.readyState >= 2)
          await pose.send({ image: videoRef.current });
        animRef.current = requestAnimationFrame(sendLoop);
      };
      animRef.current = requestAnimationFrame(sendLoop);
    } catch (e: any) {
      alert("Camera error: " + e.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopRef.current = true;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    poseRef.current?.close(); poseRef.current = null;
  }, []);

  // ── Session control ───────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!assignmentId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:5000/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed to start session");
      const data = await res.json();
      setSessionId(data.session.id);
      setIsActive(true);
      matcherRef.current = new LiveMatcher(templateFramesRef.current);
      repCountRef.current = 0;
      setMatchResult({ similarity: 0, repCount: 0, status: "Perform the exercise" });
      initPose();
    } catch (e: any) {
      alert(`Could not start session: ${e.message}`);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    const token = localStorage.getItem("token");
    stopCamera();
    setIsActive(false);

    try {
      await fetch("http://localhost:5000/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
    } catch (e) {
      console.error("Failed to complete session", e);
    }

    const reps = repCountRef.current;
    const mins = Math.floor(timer / 60), secs = timer % 60;
    alert(`Session complete!\n\nReps: ${reps}\nDuration: ${mins}:${secs < 10 ? "0" : ""}${secs}`);
    navigate("/patient");
  };

  // ── Format timer ─────────────────────────────────────────────────────────
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Similarity colour ─────────────────────────────────────────────────────
  const simColour = (s: number) =>
    s >= 75 ? "text-emerald-400" : s >= 45 ? "text-yellow-400" : "text-slate-400";

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
        <p className="text-red-400 text-lg font-medium">{error}</p>
        <button
          onClick={() => navigate("/patient")}
          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const prescription = assignment?.prescription ?? { sets: 3, repsPerSet: 10 };
  const targetReps = (prescription.sets ?? 3) * (prescription.repsPerSet ?? 10);

  return (
    <div className="h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* ── CAMERA AREA ───────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-transparent z-10 pointer-events-none" />

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10 pointer-events-none"
        />

        {/* Back button */}
        <button
          onClick={() => { stopCamera(); navigate("/patient"); }}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition"
        >
          <ChevronLeft size={16} /> Dashboard
        </button>

        {/* Similarity ring — centre of camera */}
        {isActive && (
          <div className="absolute inset-0 z-20 flex items-end justify-center pb-8 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl px-6 py-3 flex items-center gap-4">
              <div className={`text-4xl font-black ${simColour(matchResult.similarity)}`}>
                {matchResult.similarity}%
              </div>
              <div className="border-l border-slate-600 pl-4">
                <p className="text-white font-semibold text-sm leading-tight">{matchResult.status}</p>
                <p className="text-slate-400 text-xs mt-0.5">Match Score</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SIDE PANEL ────────────────────────────────────────────────────── */}
      <div className="w-full md:w-80 bg-slate-900 border-l border-slate-800 flex flex-col p-6 gap-5 overflow-y-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={18} className="text-teal-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Custom Exercise</span>
          </div>
          <h1 className="text-xl font-extrabold text-white leading-tight">
            {template?.name ?? "Exercise"}
          </h1>
          {template?.description && (
            <p className="text-slate-400 text-sm mt-1">{template.description}</p>
          )}
        </div>

        {/* Prescription */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-white">{prescription.sets}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Sets</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-white">{prescription.repsPerSet}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Reps / Set</p>
          </div>
        </div>

        {/* Live stats */}
        <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Repeat2 size={16} />
              <span>Reps Done</span>
            </div>
            <span className="text-white font-black text-xl">
              {matchResult.repCount}
              <span className="text-slate-500 font-normal text-sm"> / {targetReps}</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Zap size={16} />
              <span>Match</span>
            </div>
            <span className={`font-black text-xl ${simColour(matchResult.similarity)}`}>
              {matchResult.similarity}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-400"
              style={{ width: `${Math.min(100, (matchResult.repCount / Math.max(targetReps, 1)) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Timer</span>
            <span className="text-white font-bold font-mono">{fmt(timer)}</span>
          </div>
        </div>

        {/* Status message */}
        {isActive && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center transition-all ${
            matchResult.status.includes("✓")
              ? "bg-emerald-500/20 text-emerald-300"
              : matchResult.similarity > 40
              ? "bg-teal-500/10 text-teal-300"
              : "bg-slate-800 text-slate-400"
          }`}>
            {matchResult.status}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action button */}
        {!isActive ? (
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-xl shadow-teal-500/20 active:scale-95"
          >
            <Play size={20} fill="white" />
            Start Session
          </button>
        ) : (
          <button
            onClick={handleEnd}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-xl shadow-red-500/20 active:scale-95"
          >
            <StopCircle size={20} />
            End Session
          </button>
        )}

        {/* Template info */}
        <p className="text-center text-[11px] text-slate-600">
          Template: {template?.frameCount} frames · {template?.durationSeconds}s recording
        </p>
      </div>
    </div>
  );
};

export default PatientCustomExercise;
