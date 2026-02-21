import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Play, StopCircle, ChevronLeft, Activity, Repeat2, Zap } from "lucide-react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import type { Results } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// ───────────────────────────────────────────────────────────────────────────────
interface NormLandmark { x: number; y: number; z: number; visibility: number; }
type NormFrame = NormLandmark[];

const FULL_BODY_IDX = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const UPPER_BODY_IDX = [11, 12, 13, 14, 15, 16];
const LOWER_CHECK = [23, 24, 25, 26];

class PoseNormalizer {
  static isFullBody(lms: any[]): boolean {
    return LOWER_CHECK.filter(i => (lms[i]?.visibility ?? 0) > 0.3).length >= 2;
  }
  static normalize(lms: any[]): NormFrame | null {
    if (!lms || lms.length < 17) return null;
    const lS = lms[11], rS = lms[12];
    if ((lS.visibility ?? 1) < 0.3 || (rS.visibility ?? 1) < 0.3) return null;
    const cx = (lS.x + rS.x) / 2, cy = (lS.y + rS.y) / 2, cz = (lS.z + rS.z) / 2;
    const sw = Math.sqrt((lS.x - rS.x) ** 2 + (lS.y - rS.y) ** 2);
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
      total += Math.sqrt((a[i].x - b[i].x) ** 2 + (a[i].y - b[i].y) ** 2 + (a[i].z - b[i].z) ** 2);
    return total / n;
  }
  static compute(s1: NormFrame[], s2: NormFrame[]): number {
    const n = s1.length, m = s2.length;
    const mat: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
    mat[0][0] = 0;
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++) {
        const cost = this.frameDistance(s1[i - 1], s2[j - 1]);
        mat[i][j] = cost + Math.min(mat[i - 1][j], mat[i][j - 1], mat[i - 1][j - 1]);
      }
    return mat[n][m] / (n + m);
  }
  static similarity(dist: number): number {
    // dist=0 -> 100%, dist=0.7 -> 0%. Wider divisor = more tolerant.
    const raw = Math.max(0, 100 * (1 - dist / 0.7));
    return raw > 50 ? Math.min(100, Math.round(raw * 1.1)) : Math.round(raw);
  }
}

interface LiveMatchResult { similarity: number; repCount: number; status: string; }

// ─────────────────────────────────────────────────────────────────────────────
// KEYFRAME MATCHER
// ─────────────────────────────────────────────────────────────────────────────

class LiveMatcher {
  private template: NormFrame[];
  repCount = 0;
  currentTargetIndex = 0;
  private isCooldown = false;
  private readonly cooldownMs = 1500;
  private readonly repThreshold = 60;  // lower = more tolerant
  private _lastResult: LiveMatchResult | null = null;
  private buffer: NormFrame[] = [];

  constructor(frames: NormFrame[]) {
    this.template = frames;
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

    this.buffer.push(frame);
    if (this.buffer.length > 5) this.buffer.shift();
    const smoothed = this.smooth(frame);

    if (this.isCooldown || this.template.length === 0) {
      if (this.isCooldown) return { similarity: 0, repCount: this.repCount, status: "Rep logged — return to start" };
      return { similarity: 0, repCount: this.repCount, status: "Preparing..." };
    }

    const targetFrame = this.template[this.currentTargetIndex];

    // Best-of-buffer: check all recent frames so briefly held poses still count
    let sim = 0;
    for (const bf of [...this.buffer, smoothed]) {
      const s = DTW.similarity(DTW.frameDistance(bf, targetFrame));
      if (s > sim) sim = s;
    }
    const dist = DTW.frameDistance(smoothed, targetFrame); // for logging only
    console.log(`[LiveMatcher] Pos ${this.currentTargetIndex + 1}/${this.template.length} | dist=${dist.toFixed(3)} bestSim=${sim.toFixed(0)}% | reps=${this.repCount}`);

    let status = `Match Position ${this.currentTargetIndex + 1} of ${this.template.length}`;
    if (sim >= this.repThreshold) {
      this.currentTargetIndex++;
      console.log(`[LiveMatcher] ✓ Hit keyframe! Now targeting ${this.currentTargetIndex}/${this.template.length}`);
      if (this.currentTargetIndex >= this.template.length) {
        this.repCount++;
        this.currentTargetIndex = 0;
        this.triggerCooldown();
        status = "✓ Rep Logged!";
        console.log(`[LiveMatcher] ✓✓ REP! Total: ${this.repCount}`);
      } else {
        status = "✓ Hit! Move to next position.";
      }
    } else if (sim > 50) {
      status = "Getting closer...";
    }

    const result = { similarity: sim, repCount: this.repCount, status };
    this._lastResult = result;
    return result;
  }

  private triggerCooldown() {
    this.isCooldown = true;
    setTimeout(() => { this.isCooldown = false; }, this.cooldownMs);
  }

  reset() {
    this.repCount = 0; this.currentTargetIndex = 0; this.isCooldown = false;
    this._lastResult = null; this.buffer = [];
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
  const [similarity, setSimilarity] = useState(0);
  const [status, setStatus] = useState("Press Start to begin");
  const [repCount, setRepCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const stopRef = useRef(false);
  const matcherRef = useRef<LiveMatcher | null>(null);
  const templateFramesRef = useRef<any[][]>([]);
  const dingAudioRef = useRef(new Audio("/ding.mp3"));

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

        // 3. Deserialise frames and init LiveMatcher
        // Handle both formats:
        //   Correct:  frames[keyframeIdx][landmarkIdx] = [x,y,z,v]   (shape: N x M x 4)
        //   Legacy buggy: frames[0][keyframeIdx][landmarkIdx] = [x,y,z,v]  (shape: 1 x N x M x 4)
        let rawFrames: number[][][] = tmplData.template.frames;
        // Detect the extra nesting: if frames.length===1 and frames[0][0][0] is an array (not a number)
        if (
          rawFrames.length === 1 &&
          Array.isArray(rawFrames[0]) &&
          Array.isArray(rawFrames[0][0]) &&
          Array.isArray((rawFrames[0][0] as unknown as number[][])[0])
        ) {
          console.log("[PatientCustomExercise] Detected legacy nested frames format — unwrapping outer array");
          rawFrames = rawFrames[0] as unknown as number[][][];
        }
        console.log("[PatientCustomExercise] Template frames count:", rawFrames.length, "landmarks per frame:", rawFrames[0]?.length);
        const normFrames: NormFrame[] = rawFrames.map((f: number[][]) =>
          f.map(([x, y, z, v]) => ({ x, y, z, visibility: v ?? 1 }))
        );
        console.log("[PatientCustomExercise] normFrames deserialized. Count:", normFrames.length);
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

  // ── MediaPipe setup ───────────────────────────────────────────────────────
  const initPose = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const dingAudio = dingAudioRef.current;

    const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    pose.onResults((r: Results) => {
      canvas.width = videoRef.current!.videoWidth || 640;
      canvas.height = videoRef.current!.videoHeight || 480;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (r.poseLandmarks) {
        const norm = PoseNormalizer.normalize(r.poseLandmarks as any);
        if (norm && matcherRef.current) {
          const res = matcherRef.current.processFrame(norm);
          setSimilarity(res.similarity);
          setStatus(res.status);

          if (res.repCount > repCount) { // Use state directly for comparison
            setRepCount(res.repCount);
            dingAudio.currentTime = 0;
            dingAudio.play().catch(e => console.log("Audio play failed:", e));
          }
          drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: "#14b8a6", lineWidth: 3 });
          drawLandmarks(ctx, r.poseLandmarks, { color: "#fff", fillColor: "#14b8a6", radius: 5 });
        } else {
          drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: "#00e5cc", lineWidth: 2 });
          drawLandmarks(ctx, r.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
        }
      } else if (matcherRef.current) {
        const res = matcherRef.current.processFrame(null);
        setStatus(res.status);
      }
      ctx.restore();
    });

    await pose.initialize();
    poseRef.current = pose;
    stopRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
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
  }, [repCount]); // Added repCount to dependencies to ensure dingAudio logic works with latest state

  const startLive = async () => {
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
      setRepCount(0);
      setSimilarity(0);
      setStatus("Perform the exercise");
      initPose();
    } catch (e: any) {
      alert(`Could not start session: ${e.message}`);
    }
  };

  const stopLive = async () => {
    if (!sessionId) return;
    const token = localStorage.getItem("token");
    stopRef.current = true;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    poseRef.current?.close(); poseRef.current = null;
    setIsActive(false);
    setStatus("Session stopped");

    try {
      await fetch("http://localhost:5000/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
    } catch (e) {
      console.error("Failed to complete session", e);
    }

    alert(`Session complete!\n\nReps: ${repCount}`);
    navigate("/patient");
  };

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
          onClick={() => { stopLive(); navigate("/patient"); }}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition"
        >
          <ChevronLeft size={16} /> Dashboard
        </button>

        {/* Similarity ring — centre of camera */}
        {isActive && (
          <div className="absolute inset-0 z-20 flex items-end justify-center pb-8 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl px-6 py-3 flex items-center gap-4">
              <div className={`text-4xl font-black ${simColour(similarity)}`}>
                {similarity}%
              </div>
              <div className="border-l border-slate-600 pl-4">
                <p className="text-white font-semibold text-sm leading-tight">{status}</p>
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
              {repCount}
              <span className="text-slate-500 font-normal text-sm"> / {targetReps}</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Zap size={16} />
              <span>Match</span>
            </div>
            <span className={`font-black text-xl ${simColour(similarity)}`}>
              {similarity}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-400"
              style={{ width: `${Math.min(100, (repCount / Math.max(targetReps, 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Status message */}
        {isActive && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center transition-all ${status.includes("✓")
            ? "bg-emerald-500/20 text-emerald-300"
            : similarity > 40
              ? "bg-teal-500/10 text-teal-300"
              : "bg-slate-800 text-slate-400"
            }`}>
            {status}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action button */}
        {!isActive ? (
          <button
            onClick={startLive}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-xl shadow-teal-500/20 active:scale-95"
          >
            <Play size={20} fill="white" />
            Start Session
          </button>
        ) : (
          <button
            onClick={stopLive}
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
