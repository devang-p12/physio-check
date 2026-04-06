import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Upload, Video, StopCircle, Cpu, Download, CheckCircle2,
  AlertCircle, RefreshCcw, ChevronRight, FileVideo, Eye, Activity,
  FlaskConical, Play, Square, BarChart3, Zap, TrendingUp, Repeat2,
  Hand, Dumbbell, Expand,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import type { Results } from "@mediapipe/pose";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import type { Results as HandResults } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "idle" | "configuring" | "capturing" | "reference_recording" | "processing" | "done" | "error";
type TestStage = "idle" | "running" | "done";
type ExerciseMode = "workout" | "stretch";
type ExerciseType = "body" | "palm";

export interface StretchConfig {
  lm1: number;
  lm2: number;
  direction: "inward" | "outward";
}

/** One normalised landmark */
interface NormLandmark { x: number; y: number; z: number; visibility: number; }

/** One normalised pose frame (array of landmarks) */
type NormFrame = NormLandmark[];

/** JSON-serialisable template */
interface ExerciseTemplate {
  name: string;
  description: string;
  category: string;
  createdAt: string;
  exerciseMode: ExerciseMode;
  exerciseType: ExerciseType;
  frameCount: number;
  durationSeconds: number;
  /** frames[i][j] = [x, y, z, visibility] */
  frames: number[][][];
  stretchConfig?: StretchConfig;
  videoUrl?: string;
  keyframeTimestamps?: number[];
}

interface LiveMatchResult { similarity: number; repCount: number; status: string; }

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS – Named pose landmarks for the stretch picker
// ─────────────────────────────────────────────────────────────────────────────

const POSE_LANDMARK_NAMES: Record<number, string> = {
  11: "Left Shoulder", 12: "Right Shoulder",
  13: "Left Elbow", 14: "Right Elbow",
  15: "Left Wrist", 16: "Right Wrist",
  23: "Left Hip", 24: "Right Hip",
  25: "Left Knee", 26: "Right Knee",
  27: "Left Ankle", 28: "Right Ankle",
};
const STRETCH_LANDMARK_OPTIONS = Object.entries(POSE_LANDMARK_NAMES).map(([idx, label]) => ({
  idx: Number(idx), label,
}));

const PALM_LANDMARK_NAMES: Record<number, string> = {
  0: "Wrist", 4: "Thumb Tip",
  8: "Index Tip", 12: "Middle Tip",
  16: "Ring Tip", 20: "Pinky Tip",
};
const PALM_STRETCH_OPTIONS = Object.entries(PALM_LANDMARK_NAMES).map(([idx, label]) => ({
  idx: Number(idx), label,
}));

const FULL_BODY_IDX = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const UPPER_BODY_IDX = [11, 12, 13, 14, 15, 16];
const LOWER_CHECK = [23, 24, 25, 26];

// ─────────────────────────────────────────────────────────────────────────────
// POSE NORMALIZER  — shoulder-width scale, mirrors reference PoseNormalizer
// ─────────────────────────────────────────────────────────────────────────────

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
      x: (lms[i].x - cx) / sw,
      y: (lms[i].y - cy) / sw,
      z: (lms[i].z - cz) / sw,
      visibility: lms[i].visibility ?? 1,
    }));
  }

  /** NormFrame → compact [x,y,z,vis][] for JSON */
  static serialise(frame: NormFrame): number[][] {
    return frame.map(lm => [lm.x, lm.y, lm.z, lm.visibility]);
  }

  /** [x,y,z,vis][] → NormFrame */
  static deserialise(raw: number[][]): NormFrame {
    return raw.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// HAND NORMALIZER — wrist-centered, normalised by wrist→middle-mcp distance
// ─────────────────────────────────────────────────────────────────────────────

class HandNormalizer {
  static normalize(lms: any[]): NormFrame | null {
    if (!lms || lms.length < 21) return null;
    const wrist = lms[0], midMcp = lms[9];
    const scale = Math.sqrt((wrist.x - midMcp.x) ** 2 + (wrist.y - midMcp.y) ** 2 + (wrist.z - midMcp.z) ** 2);
    if (scale < 0.01) return null;
    return lms.map((lm) => ({
      x: (lm.x - wrist.x) / scale,
      y: (lm.y - wrist.y) / scale,
      z: (lm.z - wrist.z) / scale,
      visibility: lm.visibility ?? 1,
    }));
  }
}



class DTW {
  /** Euclidean distance between two pose frames (no visibility filter — matches reference DTW) */
  static frameDistance(a: NormFrame, b: NormFrame): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 1;
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += Math.sqrt((a[i].x - b[i].x) ** 2 + (a[i].y - b[i].y) ** 2 + (a[i].z - b[i].z) ** 2);
    }
    return total / n;
  }

  /** Full DTW distance, normalised by path length */
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

  /** DTW distance → 0–100 similarity with non-linear boost */
  static similarity(dist: number): number {
    const raw = Math.max(0, 100 * (1 - dist / 1.0));
    if (raw > 50) return Math.min(100, Math.round(raw * 1.2));
    return Math.round(raw);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYFRAME MATCHER
// ─────────────────────────────────────────────────────────────────────────────

class LiveMatcher {
  private template: NormFrame[];
  repCount = 0;
  currentTargetIndex = 0;
  private isCooldown = false;
  private readonly cooldownMs = 1500;
  private readonly repThreshold = 80; // Matching threshold
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
    const dist = DTW.frameDistance(smoothed, targetFrame);
    const sim = DTW.similarity(dist);

    let status = `Target Position ${this.currentTargetIndex + 1}/${this.template.length}`;
    if (sim >= this.repThreshold) {
      this.currentTargetIndex++;
      if (this.currentTargetIndex >= this.template.length) {
        this.repCount++;
        this.currentTargetIndex = 0;
        this.triggerCooldown();
        status = "✓ Rep Logged!";
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function exportTemplate(tmpl: ExerciseTemplate) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(tmpl, null, 2)], { type: "application/json" }));
  a.download = `${tmpl.name.replace(/\s+/g, "_").toLowerCase()}_template.json`;
  document.body.appendChild(a); a.click(); a.remove();
}

function parseTemplateFile(file: File): Promise<ExerciseTemplate> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const t = JSON.parse(e.target?.result as string);
        if (!t.frames || !t.name) throw new Error("Invalid template format");
        res(t as ExerciseTemplate);
      } catch { rej(new Error("Invalid JSON template file")); }
    };
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsText(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE POSE PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

const LivePosePreview = ({ onClose }: { onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [status, setStatus] = useState("Initializing pose model...");
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults((r: Results) => {
          const c = canvasRef.current, v = videoRef.current;
          if (!c || !v) return;
          c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
          const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);
          if (r.poseLandmarks) {
            drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: "#14b8a6", lineWidth: 3 });
            drawLandmarks(ctx, r.poseLandmarks, { color: "#fff", fillColor: "#14b8a6", radius: 5 });
            if (!cancelled) { setDetected(true); setStatus("✓ Pose detected — MediaPipe is working correctly"); }
          } else {
            if (!cancelled) { setDetected(false); setStatus("Stand back so your full body is visible"); }
          }
        });
        await pose.initialize();
        if (cancelled) return;
        const cam = new Camera(videoRef.current!, {
          onFrame: async () => { if (videoRef.current) await pose.send({ image: videoRef.current }); },
          width: 640, height: 480,
        });
        cameraRef.current = cam;
        await cam.start();
        if (!cancelled) setStatus("Stand back so your full body is visible");
      } catch (e: any) { if (!cancelled) setStatus("Error: " + e.message); }
    })();
    return () => { cancelled = true; cameraRef.current?.stop(); };
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center"><Eye size={16} className="text-white" /></div>
          <div>
            <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest">Test Mode</p>
            <p className="text-white font-bold text-sm">Live Camera + Pose Detection</p>
          </div>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <X size={16} /> Close Test
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} autoPlay playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" style={{ transform: "scaleX(-1)" }} />
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 backdrop-blur-sm text-white text-sm font-semibold px-6 py-3 rounded-full shadow-xl ${detected ? "bg-emerald-500/90" : "bg-slate-800/90"}`}>
          {detected ? <CheckCircle2 size={16} /> : <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
          {status}
        </div>
        {!detected && <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-xs font-medium px-4 py-2 rounded-full">Stand 2–3 meters from the camera</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE TESTER — DTW + rep counting
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateTesterProps { template: ExerciseTemplate; onClose: () => void; visible: boolean; }

const TemplateTester = ({ template, onClose, visible }: TemplateTesterProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const stopRef = useRef(false);   // cancellation flag
  const matcherRef = useRef<LiveMatcher | null>(null);
  const templateFramesRef = useRef<NormFrame[]>([]);

  const [testStage, setTestStage] = useState<TestStage>("idle");
  const [status, setStatus] = useState("Initializing pose model...");
  const [detected, setDetected] = useState(false);
  const [similarity, setSimilarity] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [bestSim, setBestSim] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────
  const stopLive = useCallback(() => {
    stopRef.current = true;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) { videoRef.current.srcObject = null; }
    if (canvasRef.current) {
      canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setDetected(false);
  }, []);

  // ── rebuild LiveMatcher when template changes ───────────────────────────
  useEffect(() => {
    const frames = template.frames.map((f: number[][]) =>
      f.map(([x, y, z, v]) => ({ x, y, z, visibility: v ?? 1 }))
    );
    templateFramesRef.current = frames;
    matcherRef.current = new LiveMatcher(frames);
  }, [template]);

  // ── stop + reset when panel is hidden ────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      stopLive();
      setTestStage("idle"); setSimilarity(0); setBestSim(0);
      setRepCount(0); setHistory([]);
      matcherRef.current = new LiveMatcher(templateFramesRef.current);
    }
  }, [visible, stopLive]);

  // ── initialise MediaPipe Pose exactly once on mount ──────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

        pose.onResults((r: Results) => {
          if (stopRef.current) return;
          const c = canvasRef.current, v = videoRef.current;
          if (!c || !v) return;
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 480;
          const ctx = c.getContext("2d")!;
          ctx.clearRect(0, 0, c.width, c.height);

          if (r.poseLandmarks) {
            const norm = PoseNormalizer.normalize(r.poseLandmarks);
            if (norm && matcherRef.current) {
              const res = matcherRef.current.processFrame(norm);
              if (!cancelled) {
                setSimilarity(res.similarity);
                setBestSim(prev => Math.max(prev, res.similarity));
                setHistory(prev => [...prev, res.similarity].slice(-60));
                setRepCount(res.repCount);
                setStatus(res.status);
                setDetected(true);
              }
              const col = res.similarity >= 75 ? "#10b981" : res.similarity >= 45 ? "#f59e0b" : "#ef4444";
              drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: col, lineWidth: 3 });
              drawLandmarks(ctx, r.poseLandmarks, { color: "#fff", fillColor: col, radius: 5 });
            } else {
              if (!cancelled) { setDetected(false); setStatus("Stand back so your full body is visible"); }
            }
          } else {
            if (!cancelled) { setDetected(false); setStatus("Stand back so your full body is visible"); }
          }
        });

        await pose.initialize();
        if (cancelled) return;
        poseRef.current = pose;
        setInitialized(true);
        setStatus("Ready — press Start Test to begin");
      } catch (e: any) {
        if (!cancelled) setStatus("Failed to load pose model: " + e.message);
      }
    })();
    return () => {
      cancelled = true;
      stopRef.current = true;
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
      poseRef.current?.close(); poseRef.current = null;
    };
  }, []);  

  // ── start live session ────────────────────────────────────────────────────
  const startTest = useCallback(async () => {
    if (!poseRef.current || !videoRef.current) return;
    matcherRef.current?.reset();
    setSimilarity(0); setBestSim(0); setRepCount(0); setHistory([]); setDetected(false);
    setStatus("Starting camera..."); setTestStage("running");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      stopRef.current = false;
      const pose = poseRef.current;
      const sendLoop = async () => {
        if (stopRef.current) return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await pose.send({ image: videoRef.current });
        }
        animRef.current = requestAnimationFrame(sendLoop);
      };
      animRef.current = requestAnimationFrame(sendLoop);
      setStatus("Stand back so your full body is visible");
    } catch (e: any) {
      setStatus("Camera error: " + e.message); setTestStage("idle");
    }
  }, []);

  // ── stop session ──────────────────────────────────────────────────────────
  const stopTest = useCallback(() => {
    stopLive();
    setTestStage("done"); setStatus("Session complete");
  }, [stopLive]);

  // ── restart ───────────────────────────────────────────────────────────────
  const restartTest = useCallback(() => {
    stopLive();
    matcherRef.current = new LiveMatcher(templateFramesRef.current);
    setTestStage("idle"); setSimilarity(0); setBestSim(0);
    setRepCount(0); setHistory([]);
    setStatus("Ready — press Start Test to begin");
  }, [stopLive]);

  const avgSim = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
  const simColor = similarity >= 75 ? "text-emerald-400" : similarity >= 45 ? "text-amber-400" : "text-red-400";
  const simBg = similarity >= 75 ? "bg-emerald-500" : similarity >= 45 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col" style={{ display: visible ? "flex" : "none" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center"><FlaskConical size={16} className="text-white" /></div>
          <div>
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Template Tester · DTW</p>
            <p className="text-white font-bold text-sm">{template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {testStage === "idle" && !initialized && (
            <div className="flex items-center gap-2 text-slate-400 text-sm px-3 py-2">
              <div className="w-4 h-4 border-2 border-slate-600 border-t-violet-400 rounded-full animate-spin" /> Loading model...
            </div>
          )}
          {testStage === "idle" && initialized && (
            <button onClick={startTest} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              <Play size={14} /> Start Test
            </button>
          )}
          {testStage === "running" && (
            <button onClick={stopTest} className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              <Square size={14} /> Stop
            </button>
          )}
          {testStage === "done" && (
            <button onClick={restartTest} className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              <RefreshCcw size={14} /> Re-test
            </button>
          )}
          <button onClick={onClose} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <X size={16} /> Close
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Camera feed */}
        <div className="relative flex-1 bg-black overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)", display: testStage === "running" ? "block" : "none" }} autoPlay playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10"
            style={{ transform: "scaleX(-1)", display: testStage === "running" ? "block" : "none" }} />

          {/* Idle / Done overlay */}
          {testStage !== "running" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <FlaskConical size={36} className="text-violet-400" />
              </div>
              {testStage === "idle" && (
                <>
                  <div className="text-center">
                    <p className="text-white font-black text-xl mb-2">Test Your Template</p>
                    <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                      Perform the exercise in view of your camera. DTW matching compares your movement sequence and counts reps automatically.
                    </p>
                  </div>
                  {!initialized ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <div className="w-4 h-4 border-2 border-slate-400/40 border-t-violet-400 rounded-full animate-spin" /> Loading pose model...
                    </div>
                  ) : (
                    <button onClick={startTest} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl transition-all active:scale-95 text-base">
                      <Play size={20} /> Start Test
                    </button>
                  )}
                </>
              )}
              {testStage === "done" && (
                <div className="text-center space-y-4">
                  <p className="text-white font-black text-xl">Session Complete</p>
                  <div className="flex gap-3">
                    {[
                      { label: "Reps", val: repCount.toString(), col: "text-violet-400" },
                      { label: "Best", val: bestSim + "%", col: "text-emerald-400" },
                      { label: "Avg", val: avgSim + "%", col: "text-teal-400" },
                    ].map(({ label, val, col }) => (
                      <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center min-w-[90px]">
                        <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${col}`}>{label}</p>
                        <p className="text-white font-black text-3xl">{val}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm max-w-xs">
                    {repCount >= 3 && bestSim >= 75 ? "🎉 Great session! Template is working perfectly."
                      : repCount > 0 ? "✅ Reps detected. Adjust threshold if needed."
                        : bestSim >= 50 ? "⚠️ Good similarity but no reps. Complete full movements."
                          : "❌ Low match. Re-record with full body clearly visible."}
                  </p>
                  <button onClick={restartTest} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors mx-auto">
                    <RefreshCcw size={16} /> Test Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Live HUD */}
          {testStage === "running" && (<>
            {/* Match % + rep count */}
            <div className="absolute top-6 left-6 z-20 flex gap-3">
              <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl px-5 py-4 border border-slate-700/50">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">DTW Match</p>
                <p className={`font-black text-5xl ${simColor} tabular-nums leading-none`}>{similarity}<span className="text-2xl">%</span></p>
                <p className={`text-xs font-semibold mt-0.5 ${simColor}`}>{status}</p>
              </div>
              <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl px-5 py-4 border border-slate-700/50 flex flex-col items-center justify-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Reps</p>
                <p className="font-black text-5xl text-violet-400 tabular-nums leading-none">{repCount}</p>
              </div>
            </div>

            {/* Best + avg */}
            <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
              <div className="bg-slate-900/85 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 flex items-center gap-2">
                <TrendingUp size={14} className="text-teal-400" /><span className="text-slate-400 text-xs">Best</span>
                <span className="text-white font-black text-lg tabular-nums">{bestSim}%</span>
              </div>
              <div className="bg-slate-900/85 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 flex items-center gap-2">
                <BarChart3 size={14} className="text-violet-400" /><span className="text-slate-400 text-xs">Avg</span>
                <span className="text-white font-black text-lg tabular-nums">{avgSim}%</span>
              </div>
            </div>

            {/* Bottom bar + sparkline */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-6">
              <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs font-semibold">DTW Similarity</span>
                  <span className={`text-xs font-bold ${simColor}`}>{similarity}%</span>
                </div>
                <div className="relative w-full bg-slate-700/60 rounded-full h-3 overflow-visible">
                  <div className={`h-full rounded-full transition-all duration-200 ${simBg}`} style={{ width: `${similarity}%` }} />
                  {/* Rep threshold marker at 75% */}
                  <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: "75%" }}>
                    <div className="w-0.5 h-5 -top-1 absolute bg-white/50 rounded" />
                    <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-slate-500 whitespace-nowrap">rep line</span>
                  </div>
                </div>
                {history.length > 1 && (
                  <div className="mt-3 flex items-end gap-0.5 h-8">
                    {history.slice(-40).map((s, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{
                        height: `${Math.max(4, s)}%`,
                        backgroundColor: s >= 75 ? "#10b981" : s >= 45 ? "#f59e0b" : "#ef4444",
                        opacity: 0.75,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pose status pill */}
            <div className={`absolute bottom-40 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 backdrop-blur-sm text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl ${detected ? "bg-emerald-500/80" : "bg-slate-800/80"}`}>
              {detected ? <Zap size={12} /> : <div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {detected ? "Pose detected" : "Looking for body..."}
            </div>
          </>)}

          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 opacity-20 pointer-events-none">
            <div className="w-5 h-5 bg-teal-600 rounded-md flex items-center justify-center"><Activity size={12} className="text-white" /></div>
            <span className="text-white text-xs font-bold tracking-tight">PhysioCheck</span>
          </div>
        </div>

        {/* Right stats panel */}
        <div className="w-64 bg-slate-800 border-l border-slate-700 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Template Info</p>
            <div className="space-y-2">
              <div className="bg-slate-700/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-0.5">Exercise</p>
                <p className="text-white text-sm font-bold">{template.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-700/60 rounded-xl p-3"><p className="text-slate-400 text-xs mb-0.5">Frames</p><p className="text-white font-black text-xl">{template.frameCount}</p></div>
                <div className="bg-slate-700/60 rounded-xl p-3"><p className="text-slate-400 text-xs mb-0.5">Duration</p><p className="text-white font-black text-xl">{template.durationSeconds}s</p></div>
              </div>
              <div className="bg-slate-700/60 rounded-xl p-3"><p className="text-slate-400 text-xs mb-0.5">Category</p><p className="text-white text-sm font-semibold">{template.category}</p></div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Live Stats</p>
            <div className="space-y-3">
              {[
                { label: "DTW Match", val: testStage === "running" ? similarity + "%" : "–", color: simColor },
                { label: "Reps Counted", val: String(repCount), color: "text-violet-400" },
                { label: "Best Match", val: bestSim > 0 ? bestSim + "%" : "–", color: "text-teal-400" },
                { label: "Avg Match", val: avgSim > 0 ? avgSim + "%" : "–", color: "text-slate-300" },
                { label: "Frames Seen", val: String(history.length), color: "text-slate-300" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">{label}</span>
                  <span className={`font-black text-lg tabular-nums ${color}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Score Guide</p>
            <div className="space-y-2 mb-4">
              {[
                { label: "Rep counted", range: "≥ 75%", color: "bg-emerald-500" },
                { label: "Good movement", range: "45–74%", color: "bg-amber-500" },
                { label: "Low match", range: "< 45%", color: "bg-red-500" },
              ].map(g => (
                <div key={g.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${g.color}`} />
                  <span className="text-slate-300 text-xs flex-1">{g.label}</span>
                  <span className="text-slate-500 text-xs">{g.range}</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-700/40 rounded-xl p-3">
              <p className="text-slate-400 text-xs font-bold mb-1">How DTW works</p>
              <p className="text-slate-400 text-xs leading-relaxed">Dynamic Time Warping compares your full movement <em>sequence</em> to the template, tolerating speed differences. A rep is counted when similarity ≥ 75%.</p>
            </div>
            {template.description && (
              <div className="mt-3 bg-slate-700/40 rounded-xl p-3">
                <p className="text-slate-400 text-xs font-bold mb-1">Clinical Notes</p>
                <p className="text-slate-300 text-xs leading-relaxed">{template.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

const Step = ({ number, label, sublabel, done, active }: {
  number: number; label: string; sublabel?: string; done: boolean; active: boolean;
}) => (
  <div className="flex items-start gap-3">
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all ${done ? "bg-emerald-500 text-white" : active ? "bg-teal-500 text-white ring-4 ring-teal-100" : "bg-slate-200 text-slate-400"}`}>
      {done ? <CheckCircle2 size={14} /> : number}
    </div>
    <div>
      <p className={`text-sm font-semibold ${done ? "text-emerald-600 line-through" : active ? "text-teal-700" : "text-slate-400"}`}>{label}</p>
      {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ["Upper Body", "Lower Body", "Core", "Full Body", "Balance", "Flexibility", "Post-Surgery", "Cardio"];

const CreateExercise = () => {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";

  const [exerciseName, setExerciseName] = useState("");
  const [exerciseDesc, setExerciseDesc] = useState("");
  const [category, setCategory] = useState("Full Body");
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>("workout");
  const [stretchConfig, setStretchConfig] = useState<StretchConfig>({ lm1: 13, lm2: 14, direction: "inward" });
  const [numKeyframes, setNumKeyframes] = useState(2);
  const [stage, setStage] = useState<Stage>("idle");
  const [keyframes, setKeyframes] = useState<NormFrame[]>([]);
  const keyframesRef = useRef<NormFrame[]>([]);
  const [currentCaptureIdx, setCurrentCaptureIdx] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [isPalmExercise, setIsPalmExercise] = useState(false);
  const exerciseType: ExerciseType = isPalmExercise ? "palm" : "body";
  // Stretch needs exactly 2 keyframes (relaxed and stretched positions)
  const effectiveNumKeyframes = exerciseMode === "stretch" ? 2 : numKeyframes;

  const [keyframeTimestamps, setKeyframeTimestamps] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [template, setTemplate] = useState<ExerciseTemplate | null>(null);
  const [showLiveTest, setShowLiveTest] = useState(false);
  const [showTemplateTester, setShowTemplateTester] = useState(false);
  const [loadedTestTemplate, setLoadedTestTemplate] = useState<ExerciseTemplate | null>(null);
  const [loadTemplateError, setLoadTemplateError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [similarity, setSimilarity] = useState(0);
  const [status, setStatus] = useState("Press Start to begin");

  const testFileInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // ── recording skeleton overlay ──
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const recPoseRef = useRef<Pose | null>(null);
  const recAnimRef = useRef<number | null>(null);
  const recCancelRef = useRef(false);
  const captureInProgressRef = useRef(false);
  const sendLoopRef = useRef<(() => void) | null>(null);  // ref to sendLoop fn so onResults can restart it
  const [recordingDetected, setRecordingDetected] = useState(false);
  const liveMatcherRef = useRef<LiveMatcher | null>(null);
  const refRecordingTimestampsRef = useRef<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const startCapturingFlow = async () => {
    if (!exerciseName.trim()) {
      setErrorMsg("Please enter an exercise name first.");
      setStage("error");
      return;
    }
    setStage("capturing");
    setKeyframes([]);
    setKeyframeTimestamps([]);
    setCurrentCaptureIdx(0);
    setCountdown(null);
    setVideoUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (liveVideoRef.current) { liveVideoRef.current.srcObject = stream; liveVideoRef.current.play(); }

      recCancelRef.current = false;
      (async () => {
        try {
          const runHands = isPalmExercise || exerciseMode === "stretch";
          const runPose = !isPalmExercise || exerciseMode === "stretch";

          let hands: Hands | null = null;
          let pose: Pose | null = null;

          if (runHands) {
            hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            hands.onResults((r: HandResults) => {
              if (recCancelRef.current) return;
              const c = liveCanvasRef.current, v = liveVideoRef.current;
              if (!c || !v) return;
              const ctx = c.getContext("2d")!;

              if (r.multiHandLandmarks && r.multiHandLandmarks.length > 0) {
                for (const handLms of r.multiHandLandmarks) {
                  drawConnectors(ctx, handLms, HAND_CONNECTIONS, { color: "#a78bfa", lineWidth: 3 });
                  drawLandmarks(ctx, handLms, { color: "#fff", fillColor: "#a78bfa", radius: 5 });
                }
                setRecordingDetected(true);
                // If we are ONLY doing hands OR we just captured, we can save a hand frame
                if (captureInProgressRef.current && (runHands || isPalmExercise)) {
                  const norm = HandNormalizer.normalize(r.multiHandLandmarks[0]);
                  if (norm) {
                    captureInProgressRef.current = false;
                    setKeyframes(prev => [...prev, norm]);
                    setCurrentCaptureIdx(prev => prev + 1);
                    if (sendLoopRef.current && !recCancelRef.current) {
                      recAnimRef.current = requestAnimationFrame(sendLoopRef.current);
                    }
                  }
                }

                // Reference Recording Sync
                if (stage === "reference_recording" && liveMatcherRef.current && (runHands || isPalmExercise)) {
                  const norm = HandNormalizer.normalize(r.multiHandLandmarks[0]);
                  if (norm) {
                    const res = liveMatcherRef.current.processFrame(norm);
                    setSimilarity(res.similarity);
                    setStatus(res.status);

                    const nextIdx = liveMatcherRef.current.currentTargetIndex;
                    if (nextIdx > refRecordingTimestampsRef.current.length) {
                      const ts = (Date.now() - recordingStartTimeRef.current) / 1000;
                      refRecordingTimestampsRef.current.push(ts);
                      console.log(`[CreateExercise] Auto-logged timestamp for keyframe ${nextIdx}: ${ts}s`);
                    }
                  }
                }
              } else if (!runPose) {
                setRecordingDetected(false); // Only unset if pose isn't running
              }
            });
            await hands.initialize();
          }

          if (runPose) {
            pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
            pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            pose.onResults((r: Results) => {
              if (recCancelRef.current) return;
              const c = liveCanvasRef.current, v = liveVideoRef.current;
              if (!c || !v) return;
              const ctx = c.getContext("2d")!;

              // Clear canvas for pose (hands runs next/parallel so they share the canvas)
              if (!runHands) {
                c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
                ctx.clearRect(0, 0, c.width, c.height);
              }

              if (r.poseLandmarks) {
                drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: "#14b8a6", lineWidth: 3 });
                drawLandmarks(ctx, r.poseLandmarks, { color: "#fff", fillColor: "#14b8a6", radius: 5 });
                setRecordingDetected(true);

                if (captureInProgressRef.current && (!runHands || !isPalmExercise)) {
                  // If Stretch mode combined, we fallback to saving the Pose as the "body" keyframe
                  // since stretch points can be on either body or hands. In reality, DTW matcher handles whatever we save here.
                  // For stretch mode we only save 1 frame.
                  const normLms = PoseNormalizer.normalize(r.poseLandmarks);
                  if (normLms) {
                    captureInProgressRef.current = false;
                    setKeyframes(prev => [...prev, normLms]);
                    setCurrentCaptureIdx(prev => prev + 1);
                    if (sendLoopRef.current && !recCancelRef.current) {
                      recAnimRef.current = requestAnimationFrame(sendLoopRef.current);
                    }
                  }
                }

                // Reference Recording Sync
                if (stage === "reference_recording" && liveMatcherRef.current && (!runHands || !isPalmExercise)) {
                  const norm = PoseNormalizer.normalize(r.poseLandmarks);
                  if (norm) {
                    const res = liveMatcherRef.current.processFrame(norm);
                    setSimilarity(res.similarity);
                    setStatus(res.status);

                    const nextIdx = liveMatcherRef.current.currentTargetIndex;
                    if (nextIdx > refRecordingTimestampsRef.current.length) {
                      const ts = (Date.now() - recordingStartTimeRef.current) / 1000;
                      refRecordingTimestampsRef.current.push(ts);
                      console.log(`[CreateExercise] Auto-logged timestamp for keyframe ${nextIdx}: ${ts}s`);
                    }
                  }
                }
              } else if (!runHands) {
                setRecordingDetected(false);
              }
            });
            await pose.initialize();
          }

          if (recCancelRef.current) {
            hands?.close(); pose?.close(); return;
          }

          recPoseRef.current = (pose || hands) as unknown as Pose;

          const sendLoop = async () => {
            if (recCancelRef.current) return;
            if (captureInProgressRef.current) return;
            if (liveVideoRef.current && liveVideoRef.current.readyState >= 2) {
              // We need to clear the canvas on every tick before the models redraw
              const c = liveCanvasRef.current, v = liveVideoRef.current;
              if (c && v) {
                c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
                c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
              }

              // Send to both models
              const promises = [];
              if (pose) promises.push(pose.send({ image: liveVideoRef.current }));
              if (hands) promises.push(hands.send({ image: liveVideoRef.current }));
              await Promise.all(promises);
            }
            recAnimRef.current = requestAnimationFrame(sendLoop);
          };

          sendLoopRef.current = sendLoop;
          recAnimRef.current = requestAnimationFrame(sendLoop);

        } catch (skErr) { console.warn("Recording skeleton error:", skErr); }
      })();
    } catch (e: any) { setErrorMsg("Camera access denied: " + e.message); setStage("error"); }
  };

  const stopRecordingSkeleton = () => {
    recCancelRef.current = true;
    if (recAnimRef.current) { cancelAnimationFrame(recAnimRef.current); recAnimRef.current = null; }
    // video recording is stopped in Phase 2
    recPoseRef.current?.close(); recPoseRef.current = null;
    setRecordingDetected(false);
    if (liveCanvasRef.current) {
      const ctx = liveCanvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, liveCanvasRef.current.width, liveCanvasRef.current.height);
    }
  };

  const captureKeyframe = () => {
    if (!recPoseRef.current || !liveVideoRef.current || !recordingDetected || countdown !== null) return;

    let currentCount = 3;
    setCountdown(currentCount);

    const interval = setInterval(() => {
      currentCount--;
      if (currentCount > 0) {
        setCountdown(currentCount);
      } else {
        clearInterval(interval);
        setCountdown(0); // Flash!

        // Snapshot the current frame
        const canvas = document.createElement('canvas');
        canvas.width = liveVideoRef.current!.videoWidth || 640;
        canvas.height = liveVideoRef.current!.videoHeight || 480;
        canvas.getContext('2d')!.drawImage(liveVideoRef.current!, 0, 0);

        // Capture the timestamp relative to the video recording
        const ts = (Date.now() - recordingStartTimeRef.current) / 1000;
        setKeyframeTimestamps(prev => [...prev, ts]);

        // Pause the sendLoop and request ONE capture frame
        captureInProgressRef.current = true;
        recPoseRef.current!.send({ image: canvas }).catch(console.error);

        // Clear the flash after 400ms
        setTimeout(() => setCountdown(null), 400);

        // Fallback: if pose never fires (body not detected), release the lock and resume preview
        setTimeout(() => {
          if (captureInProgressRef.current) {
            captureInProgressRef.current = false;
            // Restart the sendLoop for the live preview
            if (sendLoopRef.current && !recCancelRef.current) {
              recAnimRef.current = requestAnimationFrame(sendLoopRef.current);
            }
          }
        }, 1500);
      }
    }, 1000);
  };

  const cancelCapture = () => {
    stopRecordingSkeleton();
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setStage("idle");
  };

  const startReferenceRecording = () => {
    if (keyframes.length === 0) return;
    setStage("reference_recording");
    setKeyframeTimestamps([]);
    refRecordingTimestampsRef.current = [];
    liveMatcherRef.current = new LiveMatcher(keyframes);

    // Start MediaRecorder
    if (streamRef.current) {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp8" });
      videoChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      recordingStartTimeRef.current = Date.now();
      console.log("[CreateExercise] Started reference video recording");
    }
  };

  const stopReferenceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setKeyframeTimestamps([...refRecordingTimestampsRef.current]);
    stopRecordingSkeleton();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setStage("processing");
  };

  const saveToLibrary = async () => {
    if (!template) return;
    const token = localStorage.getItem("token");
    setSaveStatus("saving"); setSaveError("");
    setIsUploading(true);

    try {
      let finalVideoUrl = "";

      // 1. Upload video if available
      if (videoChunksRef.current.length > 0) {
        setSaveStatus("saving"); // maybe a separate status for uploading?
        const videoBlob = new Blob(videoChunksRef.current, { type: "video/webm" });
        const formData = new FormData();
        formData.append("video", videoBlob, "reference.webm");

        const uploadRes = await fetch("http://localhost:5000/doctor/upload-video", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Video upload failed");
        const uploadData = await uploadRes.json();
        finalVideoUrl = uploadData.videoUrl;
      }

      // 2. Save Template
      const res = await fetch("http://localhost:5000/doctor/custom-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          category: template.category,
          exerciseMode: template.exerciseMode,
          exerciseType: template.exerciseType,
          frameCount: template.frameCount,
          durationSeconds: template.durationSeconds,
          frames: template.frames,
          stretchConfig: template.stretchConfig,
          videoUrl: finalVideoUrl,
          keyframeTimestamps: template.keyframeTimestamps,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Save failed");
      }
      setSaveStatus("saved");
    } catch (e: any) {
      setSaveError(e.message ?? "Unknown error");
      setSaveStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadTestTemplate = async (file: File) => {
    setLoadTemplateError("");
    try { setLoadedTestTemplate(await parseTemplateFile(file)); }
    catch (e: any) { setLoadTemplateError(e.message); }
  };

  // When all keyframes are captured during "capturing" stage, move to reference recording wait
  useEffect(() => {
    if (stage === "capturing" && effectiveNumKeyframes > 0 && keyframes.length >= effectiveNumKeyframes) {
      // Don't stop camera, let doctor prepare for clean rep
      setStage("reference_recording");
    }
  }, [keyframes.length, effectiveNumKeyframes, stage]);

  // Keep keyframesRef up-to-date so the packaging useEffect is never stale
  useEffect(() => { keyframesRef.current = keyframes; }, [keyframes]);

  // Package captured keyframes into a template once in "processing" stage
  useEffect(() => {
    if (stage === "processing") {
      const kfs = keyframesRef.current;
      console.log("[CreateExercise] Packaging template. keyframes count:", kfs.length);
      if (kfs.length === 0) {
        setErrorMsg("No keyframes captured — try again.");
        setStage("error");
        return;
      }
      const frames = kfs.map((frame: NormFrame) =>
        frame.map((lm: NormLandmark) =>
          ([lm.x, lm.y, lm.z, lm.visibility ?? 1] as [number, number, number, number])
        )
      );
      setTemplate({
        name: exerciseName.trim(),
        description: exerciseDesc.trim(),
        category,
        createdAt: new Date().toISOString(),
        exerciseMode,
        exerciseType,
        frameCount: kfs.length,
        durationSeconds: 0,
        frames,
        stretchConfig: exerciseMode === "stretch" ? stretchConfig : undefined,
        keyframeTimestamps,
      });
      setStage("done");
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    stopRecordingSkeleton();
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setStage("idle"); setKeyframes([]); setCurrentCaptureIdx(0); setCountdown(null);
    setProgress(0); setErrorMsg(""); setTemplate(null);
  };

  const canProcess =
    exerciseName.trim().length > 0 &&
    (exerciseMode === "stretch" || (numKeyframes >= 2 && numKeyframes <= 10));
  const activeTestTemplate = template ?? loadedTestTemplate;

  return (
    <div className="flex h-[calc(100vh-60px)] bg-slate-50 font-sans overflow-hidden">

      {/* ── LEFT — VIDEO PANEL ── */}
      <div className="relative flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 via-slate-900 to-slate-900 pointer-events-none" />

        {showLiveTest && <LivePosePreview onClose={() => setShowLiveTest(false)} />}

        {activeTestTemplate && (
          <TemplateTester template={activeTestTemplate} visible={showTemplateTester} onClose={() => setShowTemplateTester(false)} />
        )}

        {/* Idle prompt */}
        {stage === "idle" && (
          <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8 max-w-md">
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-2xl">
                <FileVideo size={48} className="text-teal-400" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-500 rounded-xl flex items-center justify-center">
                <Activity size={16} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Add Reference Video</h2>
              <p className="text-slate-400 text-sm leading-relaxed">Record or upload a single clean exercise repetition. Stand 2–3 metres from the camera so your full body is visible.</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={startCapturingFlow}
                disabled={!canProcess}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold px-5 py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-teal-900/40">
                <Video size={20} /> Start Capturing Keyframes
              </button>
              <button onClick={() => setShowLiveTest(true)} className="w-full flex items-center justify-center gap-2 border border-slate-600 hover:border-teal-500 hover:bg-teal-500/10 text-slate-300 hover:text-teal-300 font-semibold px-5 py-3 rounded-2xl transition-all">
                <Eye size={18} /> Test Camera & Pose Detection
              </button>
            </div>
          </div>
        )}

        {/* Video & Canvas layer (used by capturing and recording) */}
        {(stage === "capturing" || stage === "reference_recording") && (
          <>
            <video ref={liveVideoRef} className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} autoPlay playsInline muted />
            <canvas ref={liveCanvasRef} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" style={{ transform: "scaleX(-1)" }} />
          </>
        )}

        {stage === "capturing" && (
          <>
            <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-red-500/90 text-white text-sm font-bold px-4 py-2 rounded-full backdrop-blur-sm shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Capturing Milestones: {currentCaptureIdx + 1} of {effectiveNumKeyframes}
              </div>
              <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-full backdrop-blur-sm transition-colors ${recordingDetected ? "bg-teal-500/90 text-white shadow-lg" : "bg-slate-800/80 text-slate-400"
                }`}>
                <span className={`w-2 h-2 rounded-full ${recordingDetected ? "bg-white" : "bg-slate-500"}`} />
                {recordingDetected ? (isPalmExercise ? "Hand detected" : "Pose detected") : "Looking for body…"}
              </div>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 z-30 flex items-center justify-center">
                {countdown > 0 ? (
                  <span className="text-white font-black text-9xl drop-shadow-[0_4px_32px_rgba(0,0,0,0.8)] animate-pulse">{countdown}</span>
                ) : (
                  <div className="absolute inset-0 bg-white/80 animate-[ping_0.5s_ease-out]" />
                )}
              </div>
            )}

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 w-full max-w-md px-6">
              <button onClick={cancelCapture} disabled={countdown !== null} className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-white font-bold px-6 py-4 rounded-2xl backdrop-blur-sm transition-all shadow-xl">
                Cancel
              </button>
              <button
                onClick={captureKeyframe}
                disabled={!recordingDetected || countdown !== null}
                className="flex-[2] flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-teal-900/40">
                <Video size={22} /> Capture Milestone {currentCaptureIdx + 1}
              </button>
            </div>
          </>
        )}

        {stage === "reference_recording" && (
          <>
            {/* Recording HUD */}
            <div className="absolute top-6 left-6 z-20 flex flex-col gap-3">
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full border border-slate-700 shadow-lg">
                <span className="text-teal-400">Phase 2:</span> Clean Rep Recording
              </div>

              {mediaRecorderRef.current?.state === "recording" && (
                <div className="flex items-center gap-2 bg-rose-600/90 text-white text-sm font-bold px-4 py-2 rounded-full backdrop-blur-sm shadow-xl animate-pulse">
                  <div className="w-2.5 h-2.5 bg-white rounded-full" /> Recording Clean Rep...
                </div>
              )}

              <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl px-5 py-4 border border-slate-700/50 shadow-2xl min-w-[200px]">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Auto-Sync Status</p>
                <div className="flex items-end gap-2">
                  <p className={`font-black text-4xl tabular-nums leading-none ${similarity >= 75 ? "text-emerald-400" : "text-white"}`}>{similarity}%</p>
                  <p className="text-xs font-bold text-slate-500 mb-1">match</p>
                </div>
                <p className="text-xs font-semibold mt-2 text-teal-400">{status}</p>
              </div>
            </div>

            {/* Milestones Checklist */}
            <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
              <div className="bg-slate-900/85 backdrop-blur-md rounded-xl p-4 border border-slate-700/50 shadow-xl max-w-[180px]">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3">MILESTONES</p>
                <div className="space-y-2">
                  {keyframes.map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${i < refRecordingTimestampsRef.current.length
                        ? "bg-emerald-500 border-emerald-400 text-white"
                        : "border-slate-600 bg-slate-800 text-slate-500"
                        }`}>
                        {i < refRecordingTimestampsRef.current.length ? <CheckCircle2 size={10} /> : <span className="text-[10px]">{i + 1}</span>}
                      </div>
                      <span className={`text-[11px] font-bold ${i < refRecordingTimestampsRef.current.length ? "text-emerald-400" : "text-slate-500"
                        }`}>
                        Milestone {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Control Bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-6 w-full max-w-md px-6 text-center">
              {!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive" ? (
                <div className="bg-slate-900/90 backdrop-blur-xl border border-teal-500/30 p-6 rounded-3xl shadow-2xl space-y-4">
                  <div>
                    <h3 className="text-white font-black text-xl mb-1">Step 2: Clean Rep</h3>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-[300px] mx-auto">Perform a smooth, professional-looking demonstration. We'll auto-sync it with your milestones.</p>
                  </div>
                  <button
                    onClick={startReferenceRecording}
                    className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 text-white font-black px-8 py-5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-teal-500/20">
                    <Play size={24} fill="currentColor" /> Start Recording
                  </button>
                  <button onClick={() => setStage("capturing")} className="text-slate-500 hover:text-white text-xs font-bold transition-colors">
                    ← Back to Keyframe Capture
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-rose-500/30 backdrop-blur-md">Recording Phase</p>
                  <button
                    onClick={stopReferenceRecording}
                    className="flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-extrabold px-12 py-5 rounded-2xl transition-all active:scale-95 shadow-2xl ring-4 ring-rose-500/20">
                    <Square size={24} fill="currentColor" className="text-rose-500" /> Stop Recording
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {stage === "processing" && (
          <div className="absolute inset-0 z-30 bg-slate-900/85 backdrop-blur-md flex flex-col items-center justify-center gap-8">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin" />
              <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-teal-300 animate-spin" style={{ animationDuration: "0.7s" }} />
              <div className="absolute inset-0 flex items-center justify-center"><Cpu size={22} className="text-teal-400" /></div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-white font-black text-xl">Analyzing Movement</p>
              <p className="text-slate-400 text-sm">Extracting pose data frame by frame...</p>
            </div>
            <div className="w-72 space-y-2">
              <div className="w-full bg-slate-700/80 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">Processing frames...</span>
                <span className="text-teal-400 font-mono font-bold">{progress}%</span>
              </div>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-emerald-500/90 text-white font-semibold px-6 py-3 rounded-full backdrop-blur-sm shadow-xl">
            <CheckCircle2 size={18} /> Template ready — {template?.frameCount} frames
          </div>
        )}
        {stage === "error" && (
          <div className="absolute bottom-8 left-6 right-6 z-20 flex items-start gap-3 bg-red-500/90 text-white text-sm px-5 py-4 rounded-2xl backdrop-blur-sm shadow-xl">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div><p className="font-bold mb-1">Analysis Failed</p><p className="text-red-100 text-xs leading-relaxed">{errorMsg}</p></div>
          </div>
        )}
        {stage !== "idle" && stage !== "processing" && (
          <button onClick={reset} className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold px-4 py-2 rounded-xl backdrop-blur-sm transition-colors">
            <RefreshCcw size={16} /> Start Over
          </button>
        )}

        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 opacity-30 pointer-events-none">
          <div className="w-5 h-5 bg-teal-600 rounded-md flex items-center justify-center"><Activity size={12} className="text-white" /></div>
          <span className="text-white text-xs font-bold tracking-tight">PhysioCheck</span>
        </div>
      </div>

      {/* ── RIGHT — SIDEBAR ── */}
      <div className="w-[420px] flex flex-col bg-white shadow-2xl overflow-y-auto">

        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <p className="text-xs font-bold text-teal-500 uppercase tracking-widest mb-1">Template Builder</p>
          <h1 className="text-2xl font-black text-slate-800">Create Exercise</h1>
          <p className="text-slate-400 text-sm mt-1">Dr. {doctorName} · Build a reference movement template</p>
        </div>

        <div className="p-6 space-y-5 flex-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exercise Name <span className="text-red-400">*</span></label>
            <input type="text" value={exerciseName} onChange={e => setExerciseName(e.target.value)}
              placeholder="e.g. Seated Knee Extension" disabled={stage === "processing" || stage === "done"}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-400 text-sm" />
            {isPalmExercise && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-violet-600">
                <Hand size={12} /> Palm exercise detected — hand skeleton will be used
              </p>
            )}
          </div>

          {/* WORKOUT / STRETCH toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exercise Mode</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              {(["workout", "stretch"] as ExerciseMode[]).map(mode => (
                <button key={mode} disabled={stage !== "idle"}
                  onClick={() => setExerciseMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all ${exerciseMode === mode
                    ? mode === "stretch" ? "bg-violet-500 text-white" : "bg-teal-500 text-white"
                    : "bg-white text-slate-400 hover:bg-slate-50"
                    }`}>
                  {mode === "workout" ? <Dumbbell size={15} /> : <Expand size={15} />}
                  {mode === "workout" ? "WORKOUT" : "STRETCH"}
                </button>
              ))}
            </div>
            {exerciseMode === "stretch" && (
              <p className="text-xs text-slate-400 mt-1">Patient must complete the movement between the relaxed and stretched positions to count a rep.</p>
            )}
          </div>

          {/* Exercise Type (Palm vs Body) — only relevant for WORKOUT */}
          {exerciseMode === "workout" && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tracking Type</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200">
                <button disabled={stage !== "idle"}
                  onClick={() => setIsPalmExercise(false)}
                  className={`flex-1 py-2.5 text-sm font-bold transition-all ${!isPalmExercise ? "bg-slate-700 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
                  Full Body
                </button>
                <button disabled={stage !== "idle"}
                  onClick={() => setIsPalmExercise(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all ${isPalmExercise ? "bg-violet-600 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
                  <Hand size={15} /> Palm / Fingers
                </button>
              </div>
              {isPalmExercise && <p className="text-xs text-violet-500 mt-1 font-semibold flex items-center gap-1"><Hand size={12} /> The exercise name should contain "palm" for best results.</p>}
            </div>
          )}

          {/* Keyframe count — hidden for stretch (always 2) */}
          {exerciseMode === "workout" && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Number of Keyframes <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-4">
                <input type="range" min="2" max="10" value={numKeyframes} onChange={e => setNumKeyframes(parseInt(e.target.value))} disabled={stage !== "idle"} className="flex-1 accent-teal-500" />
                <span className="w-8 text-center text-slate-800 font-black">{numKeyframes}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">How many distinct positions defines one full repetition?</p>
            </div>
          )}

          {/* Stretch config — landmark picker + direction */}
          {exerciseMode === "stretch" && stage === "idle" && (
            <div className="space-y-3 bg-violet-50 border border-violet-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wider">Stretch Configuration</p>
              <div className="grid grid-cols-2 gap-3">
                {["lm1", "lm2"].map((key, i) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Point {i + 1}</label>
                    <select
                      value={stretchConfig[key as "lm1" | "lm2"]}
                      onChange={e => setStretchConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      {(exerciseMode === "stretch" ? STRETCH_LANDMARK_OPTIONS.concat(PALM_STRETCH_OPTIONS) : isPalmExercise ? PALM_STRETCH_OPTIONS : STRETCH_LANDMARK_OPTIONS).map(opt => (
                        <option key={opt.idx} value={opt.idx}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Direction</label>
                <div className="flex rounded-xl overflow-hidden border border-violet-200">
                  {(["inward", "outward"] as const).map(dir => (
                    <button key={dir}
                      onClick={() => setStretchConfig(prev => ({ ...prev, direction: dir }))}
                      className={`flex-1 py-2 text-xs font-bold transition-all ${stretchConfig.direction === dir ? "bg-violet-500 text-white" : "bg-white text-slate-400 hover:bg-violet-50"
                        }`}>
                      {dir === "inward" ? "← Inward (bring closer)" : "Outward → (spread apart)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} disabled={stage === "processing" || stage === "done"}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${category === cat ? "bg-teal-500 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Clinical Notes</label>
            <textarea value={exerciseDesc} onChange={e => setExerciseDesc(e.target.value)}
              placeholder="Instructions for the patient, contraindications, target muscles..." rows={3}
              disabled={stage === "processing" || stage === "done"}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all resize-none disabled:bg-slate-50 disabled:text-slate-400 text-sm" />
          </div>

          <div className="border-t border-slate-100" />

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Progress</p>
            <div className="space-y-4">
              <Step number={1} label="Milestone Capture" sublabel="Setup landmarks for matching" done={stage === "reference_recording" || stage === "processing" || stage === "done"} active={stage === "capturing"} />
              <Step number={2} label="Clean Rep Recording" sublabel="Record 1 smooth demonstration" done={stage === "processing" || stage === "done"} active={stage === "reference_recording"} />
              <Step number={3} label="AI Analysis" sublabel="Extracting movement data" done={stage === "done"} active={stage === "processing"} />
              <Step number={4} label="Published Template" sublabel="Ready to assign to patients" done={false} active={stage === "done"} />
            </div>
          </div>

          {template && stage === "done" && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /><p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Template Generated</p></div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white rounded-xl p-3"><p className="text-emerald-500 text-xs font-medium mb-0.5">Frames</p><p className="text-slate-800 font-black text-lg">{template.frameCount}</p></div>
                <div className="bg-white rounded-xl p-3"><p className="text-emerald-500 text-xs font-medium mb-0.5">Duration</p><p className="text-slate-800 font-black text-lg">{template.durationSeconds}s</p></div>
                <div className="bg-white rounded-xl p-3 col-span-2"><p className="text-emerald-500 text-xs font-medium mb-0.5">Exercise</p><p className="text-slate-800 font-bold text-sm">{template.name}</p></div>
              </div>
            </div>
          )}

          {/* Template Tester */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center"><FlaskConical size={14} className="text-violet-600" /></div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Template Tester</p>
              <span className="text-[10px] bg-violet-100 text-violet-600 font-bold px-2 py-0.5 rounded-full">Keyframe Matcher</span>
            </div>

            {stage === "done" && template && (
              <div className="mb-3 bg-violet-50 border border-violet-100 rounded-2xl p-4">
                <p className="text-xs text-violet-700 font-semibold mb-2">Reference video recorded!</p>
                {videoUrl && (
                  <video src={videoUrl} controls className="w-full aspect-video rounded-xl bg-black mb-3 border border-violet-200" />
                )}
                <p className="text-xs text-violet-500 mb-3">Keyframe matching + automatic rep counting</p>
                <button onClick={() => setShowTemplateTester(true)}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm">
                  <FlaskConical size={16} /> Test Generated Template
                </button>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-slate-500 font-medium">Or load an existing template JSON:</p>
              {loadedTestTemplate ? (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-violet-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-slate-800 font-bold text-sm truncate">{loadedTestTemplate.name}</p>
                      <p className="text-slate-400 text-xs">{loadedTestTemplate.frameCount} frames · {loadedTestTemplate.durationSeconds}s · {loadedTestTemplate.category}</p>
                    </div>
                    <button onClick={() => { setLoadedTestTemplate(null); setLoadTemplateError(""); }} className="text-slate-300 hover:text-red-400 transition-colors shrink-0"><X size={14} /></button>
                  </div>
                  <button onClick={() => setShowTemplateTester(true)}
                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm">
                    <FlaskConical size={16} /> Test Loaded Template
                  </button>
                </div>
              ) : (
                <button onClick={() => testFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-slate-400 hover:text-violet-600 font-semibold py-3 rounded-xl transition-all text-sm">
                  <Upload size={16} /> Load Template JSON
                </button>
              )}
              {loadTemplateError && <p className="text-red-500 text-xs flex items-center gap-1.5"><AlertCircle size={12} />{loadTemplateError}</p>}
              <input ref={testFileInputRef} type="file" accept="application/json,.json" className="hidden"
                onChange={e => e.target.files?.[0] && handleLoadTestTemplate(e.target.files[0])} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 space-y-3 bg-slate-50/50">
          {stage === "done" && (<>
            <button onClick={() => template && exportTemplate(template)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-base font-bold py-4 rounded-2xl shadow-lg shadow-teal-100 transition-all active:scale-95 flex items-center justify-center gap-3">
              <Download size={20} /> Export Template JSON
            </button>
            {/* ── Save to Library ── */}
            {saveStatus !== "saved" && (
              <button
                onClick={saveToLibrary}
                disabled={saveStatus === "saving"}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                {saveStatus === "saving"
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                  : <><CheckCircle2 size={18} /> Save to Doctor Library</>}
              </button>
            )}
            {saveStatus === "saved" && (
              <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold py-3 rounded-2xl flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Saved to library — assign it from the Assign Exercise page
              </div>
            )}
            {saveStatus === "error" && (
              <p className="text-red-500 text-xs text-center">{saveError}</p>
            )}
            <button onClick={() => setShowTemplateTester(true)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <Repeat2 size={18} /> Test This Template Live
            </button>
            <button onClick={reset}
              className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm">
              <RefreshCcw size={16} /> Create Another Exercise
            </button>
          </>)}

          {stage === "processing" && (
            <button disabled className="w-full bg-teal-100 text-teal-400 text-base font-bold py-4 rounded-2xl flex items-center justify-center gap-3 cursor-not-allowed">
              <Cpu size={20} className="animate-pulse" /> Analyzing... {progress}%
            </button>
          )}

          {!["processing", "done"].includes(stage) && (<>
            {stage === "idle" && <p className="text-center text-xs text-slate-400">Add an exercise name and click Start to begin capturing milestones.</p>}
            {stage === "capturing" && <p className="text-center text-xs text-slate-400">Capture the sequence of {numKeyframes} keyframes to define the exercise.</p>}
            {stage === "reference_recording" && <p className="text-center text-xs text-slate-400">Stand 2-3m back and perform one clean repetition.</p>}
            {stage === "error" && <button onClick={reset} className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold py-3 rounded-2xl transition-colors text-sm">Try Again</button>}
          </>)}
        </div>
      </div>
    </div >
  );
};

export default CreateExercise;