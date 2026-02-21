import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Upload, Video, StopCircle, Cpu, Download, CheckCircle2,
  AlertCircle, RefreshCcw, ChevronRight, FileVideo, Eye, Activity,
  FlaskConical, Play, Square, BarChart3, Zap, TrendingUp, Repeat2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Pose, Results, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "idle" | "recording" | "recorded" | "processing" | "done" | "error";
type TestStage = "idle" | "running" | "done";

interface NormLandmark { x: number; y: number; z: number; visibility: number; }
type NormFrame = NormLandmark[];

interface ExerciseTemplate {
  name: string;
  description: string;
  category: string;
  createdAt: string;
  frameCount: number;
  durationSeconds: number;
  frames: number[][][];
}

interface LiveMatchResult { similarity: number; repCount: number; status: string; }

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FULL_BODY_IDX  = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const UPPER_BODY_IDX = [11, 12, 13, 14, 15, 16];
const LOWER_CHECK    = [23, 24, 25, 26];

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const LOG  = (...args: any[]) => console.log("%c[PHYSIO]",  "color:#14b8a6;font-weight:bold", ...args);
const WARN = (...args: any[]) => console.warn("%c[PHYSIO]", "color:#f59e0b;font-weight:bold", ...args);
const ERR  = (...args: any[]) => console.error("%c[PHYSIO]","color:#ef4444;font-weight:bold", ...args);

// ─────────────────────────────────────────────────────────────────────────────
// MEDIAPIPE SINGLETON
// Only one Pose instance is ever created. All components share it by swapping
// the active callback via updatePoseCallback(). This prevents the
// "Module.arguments has been replaced" WASM crash that occurs when multiple
// Pose instances are initialised on the same page.
// ─────────────────────────────────────────────────────────────────────────────

type PoseResultsCallback = (r: Results) => void;

let _sharedPose: Pose | null = null;
let _initPromise: Promise<Pose> | null = null;
let _activeCallback: PoseResultsCallback | null = null;

async function getSharedPose(onResults: PoseResultsCallback): Promise<Pose> {
  _activeCallback = onResults;

  if (_initPromise) {
    // Already initialised (or initialising) — just swap the callback
    const pose = await _initPromise;
    pose.onResults((r: Results) => { _activeCallback?.(r); });
    return pose;
  }

  _initPromise = (async () => {
    LOG("SharedPose: initialising singleton Pose...");
    const pose = new Pose({
      locateFile: f =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`,
    });
    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    // Route every result through the indirection so callers can hot-swap
    pose.onResults((r: Results) => { _activeCallback?.(r); });
    await pose.initialize();
    _sharedPose = pose;
    LOG("SharedPose: singleton ready ✅");
    return pose;
  })();

  return _initPromise;
}

/** Call this at the start of each active session to point results at the
 *  correct handler without re-initialising the WASM module. */
function updatePoseCallback(onResults: PoseResultsCallback) {
  _activeCallback = onResults;
}

/** Send a frame to the shared pose instance (safe to call before init). */
async function sendToSharedPose(image: HTMLVideoElement | HTMLCanvasElement) {
  if (_sharedPose) await _sharedPose.send({ image });
}

// ─────────────────────────────────────────────────────────────────────────────
// POSE NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────

class PoseNormalizer {
  static isFullBody(lms: any[]): boolean {
    return LOWER_CHECK.filter(i => (lms[i]?.visibility ?? 0) > 0.15).length >= 2;
  }

  static normalize(lms: any[], forceIdx?: number[]): NormFrame | null {
    if (!lms || lms.length < 17) {
      WARN("normalize: landmark array too short or null", { length: lms?.length });
      return null;
    }
    const lS = lms[11], rS = lms[12];
    const lVis = lS?.visibility ?? 1;
    const rVis = rS?.visibility ?? 1;
    if (lVis < 0.15 || rVis < 0.15) {
      WARN("normalize: shoulders not visible", { leftShoulder: lVis.toFixed(3), rightShoulder: rVis.toFixed(3) });
      return null;
    }
    const cx = (lS.x + rS.x) / 2, cy = (lS.y + rS.y) / 2, cz = (lS.z + rS.z) / 2;
    const sw = Math.sqrt((lS.x - rS.x) ** 2 + (lS.y - rS.y) ** 2);
    if (sw < 0.01) {
      WARN("normalize: shoulder width too small", { sw });
      return null;
    }
    const autoIdx = this.isFullBody(lms) ? FULL_BODY_IDX : UPPER_BODY_IDX;
    const idx = forceIdx ?? autoIdx;
    if (forceIdx && forceIdx.length !== autoIdx.length) {
      WARN("normalize: forceIdx length differs from auto-detected", {
        forced: forceIdx.length, autoDetected: autoIdx.length,
      });
    }
    return idx.map(i => ({
      x: (lms[i].x - cx) / sw,
      y: (lms[i].y - cy) / sw,
      z: (lms[i].z - cz) / sw,
      visibility: lms[i]?.visibility ?? 1,
    }));
  }

  static serialise(frame: NormFrame): number[][] {
    return frame.map(lm => [lm.x, lm.y, lm.z, lm.visibility]);
  }

  static deserialise(raw: number[][]): NormFrame {
    return raw.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
  }

  static inferIdx(templateFrames: number[][][]): number[] {
    const landmarkCount = templateFrames[0]?.length ?? 6;
    const idx = landmarkCount === FULL_BODY_IDX.length ? FULL_BODY_IDX : UPPER_BODY_IDX;
    LOG("inferIdx:", landmarkCount, "landmarks/frame →", idx === FULL_BODY_IDX ? "FULL_BODY(12)" : "UPPER_BODY(6)");
    return idx;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DTW
// ─────────────────────────────────────────────────────────────────────────────

class DTW {
  static frameDistance(a: NormFrame, b: NormFrame): number {
    if (a.length !== b.length) {
      WARN("DTW.frameDistance: LENGTH MISMATCH", { live: a.length, template: b.length });
    }
    const n = Math.min(a.length, b.length);
    if (n === 0) return 1;
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += Math.sqrt(
        (a[i].x - b[i].x) ** 2 +
        (a[i].y - b[i].y) ** 2 +
        (a[i].z - b[i].z) ** 2
      );
    }
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
    const raw = Math.max(0, Math.min(100, 100 * (1 - dist / 1.0)));
    if (raw > 60) return Math.min(100, Math.round(raw * 1.1));
    if (raw > 40) return Math.round(raw * 1.05);
    return Math.round(raw);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE MATCHER
// ─────────────────────────────────────────────────────────────────────────────

class LiveMatcher {
  private template: NormFrame[];
  private landmarkIdx: number[];
  private windowSize: number;
  private buffer: NormFrame[] = [];
  repCount = 0;
  private isCooldown = false;
  private readonly cooldownMs = 1500;
  private readonly repThreshold = 55;
  private lastSampleMs = 0;
  private readonly sampleIntervalMs = 100;
  private _lastResult: LiveMatchResult | null = null;
  private _totalCalls   = 0;
  private _nullCalls    = 0;
  private _normFails    = 0;
  private _throttled    = 0;
  private _dtwRuns      = 0;

  constructor(frames: NormFrame[], landmarkIdx: number[]) {
    this.template    = frames;
    this.landmarkIdx = landmarkIdx;
    this.windowSize  = Math.round(frames.length * 1.5);
    LOG("LiveMatcher constructed", {
      templateFrames:    frames.length,
      landmarksPerFrame: frames[0]?.length,
      landmarkIdx,
      windowSize:        this.windowSize,
      repThreshold:      this.repThreshold,
    });
  }

  private smooth(frame: NormFrame): NormFrame {
    if (this.buffer.length === 0) return frame;
    const last = this.buffer[this.buffer.length - 1];
    return frame.map((lm, i) => ({
      x:          lm.x * 0.7 + (last[i]?.x ?? lm.x) * 0.3,
      y:          lm.y * 0.7 + (last[i]?.y ?? lm.y) * 0.3,
      z:          lm.z * 0.7 + (last[i]?.z ?? lm.z) * 0.3,
      visibility: lm.visibility,
    }));
  }

  processFrame(rawLandmarks: any[] | null): LiveMatchResult {
    this._totalCalls++;

    if (this._totalCalls % 50 === 0) {
      LOG("LiveMatcher health @call", this._totalCalls, {
        nullFrames:  this._nullCalls,
        normFails:   this._normFails,
        throttled:   this._throttled,
        dtwRuns:     this._dtwRuns,
        bufferLen:   this.buffer.length,
        windowSize:  this.windowSize,
        reps:        this.repCount,
        cooldown:    this.isCooldown,
      });
    }

    if (!rawLandmarks) {
      this._nullCalls++;
      if (this._nullCalls % 20 === 1) {
        WARN("processFrame: no landmarks from MediaPipe", { nullCount: this._nullCalls, total: this._totalCalls });
      }
      return { similarity: 0, repCount: this.repCount, status: "Detecting body..." };
    }

    if (this._totalCalls - this._nullCalls === 1) {
      LOG("processFrame: FIRST landmark array", {
        count: rawLandmarks.length,
        lm11: { vis: rawLandmarks[11]?.visibility?.toFixed(3), x: rawLandmarks[11]?.x?.toFixed(3) },
        lm12: { vis: rawLandmarks[12]?.visibility?.toFixed(3), x: rawLandmarks[12]?.x?.toFixed(3) },
      });
    }

    const now = Date.now();
    if (now - this.lastSampleMs < this.sampleIntervalMs) {
      this._throttled++;
      return this._lastResult ?? { similarity: 0, repCount: this.repCount, status: "Preparing..." };
    }
    this.lastSampleMs = now;

    const frame = PoseNormalizer.normalize(rawLandmarks, this.landmarkIdx);
    if (!frame) {
      this._normFails++;
      if (this._normFails % 10 === 1) {
        WARN("processFrame: normalize returned null", {
          failCount:  this._normFails,
          lm11_vis:   rawLandmarks[11]?.visibility?.toFixed(3),
          lm12_vis:   rawLandmarks[12]?.visibility?.toFixed(3),
          landmarkIdx: this.landmarkIdx,
        });
      }
      return { similarity: 0, repCount: this.repCount, status: "Stand back so your full body is visible" };
    }

    if (this.buffer.length === 0) {
      LOG("processFrame: first normalised frame", {
        liveFrameLen:     frame.length,
        templateFrameLen: this.template[0]?.length,
        lengthMatch:      frame.length === this.template[0]?.length ? "✅ OK" : "❌ MISMATCH",
      });
    }

    this.buffer.push(this.smooth(frame));
    if (this.buffer.length > this.windowSize) this.buffer.shift();

    const minRequired = Math.ceil(this.template.length * 0.5);
    if (this.buffer.length < minRequired) {
      if (this.buffer.length % 5 === 0) {
        LOG("buffer filling", { have: this.buffer.length, need: minRequired });
      }
      const r = { similarity: 0, repCount: this.repCount, status: "Preparing..." };
      this._lastResult = r;
      return r;
    }

    this._dtwRuns++;
    const tLen = this.template.length;
    const sliceDefs = [
      { label: "1.0x", slice: this.buffer.slice(-tLen) },
      { label: "0.8x", slice: this.buffer.slice(-Math.round(tLen * 0.8)) },
      { label: "1.2x", slice: this.buffer.slice(-Math.round(tLen * 1.2)) },
    ].filter(s => s.slice.length >= 5);

    let best = 0, bestRawDist = Infinity, bestLabel = "";
    const sliceResults: Record<string, string> = {};

    for (const { label, slice } of sliceDefs) {
      const rawDist = DTW.compute(slice, this.template);
      const s = DTW.similarity(rawDist);
      sliceResults[label] = `dist=${rawDist.toFixed(4)} sim=${s}%`;
      if (s > best) { best = s; bestRawDist = rawDist; bestLabel = label; }
    }

    LOG("DTW", {
      bestSlice:    bestLabel,
      rawDist:      bestRawDist.toFixed(4),
      similarity:   best + "%",
      threshold:    this.repThreshold + "%",
      willRep:      best > this.repThreshold && !this.isCooldown,
      cooldown:     this.isCooldown,
      buf:          this.buffer.length + "/" + this.windowSize,
      reps:         this.repCount,
      slices:       sliceResults,
    });

    let status = "Perform Movement";
    if (best > this.repThreshold && !this.isCooldown) {
      this.repCount++;
      LOG("🎉 REP COUNTED", { rep: this.repCount, sim: best + "%", dist: bestRawDist.toFixed(4) });
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
      const keep = Math.round(this.buffer.length * 0.25);
      LOG("cooldown ended — buffer trimmed to", keep, "frames");
      this.buffer = this.buffer.slice(-keep);
    }, this.cooldownMs);
  }

  reset() {
    LOG("LiveMatcher.reset()", { hadReps: this.repCount });
    this.repCount = 0; this.buffer = []; this.isCooldown = false;
    this.lastSampleMs = 0; this._lastResult = null;
    this._totalCalls = 0; this._nullCalls = 0; this._normFails = 0;
    this._throttled = 0; this._dtwRuns = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE PROCESSOR — uses the shared singleton
// ─────────────────────────────────────────────────────────────────────────────

class TemplateProcessor {
  private series: NormFrame[] = [];
  private frameResolved: (() => void) | null = null;
  private poseReady = false;

  async initPose(): Promise<void> {
    if (this.poseReady) return;
    LOG("TemplateProcessor: acquiring shared Pose...");
    await getSharedPose((r: Results) => {
      // This callback is only active while processVideo() is running because
      // we call updatePoseCallback() before and after.
      if (r.poseLandmarks) {
        const n = PoseNormalizer.normalize(r.poseLandmarks as any);
        if (n) this.series.push(n);
      }
      if (this.frameResolved) {
        const cb = this.frameResolved;
        this.frameResolved = null;
        cb();
      }
    });
    this.poseReady = true;
    LOG("TemplateProcessor: Pose ready");
  }

  async processVideo(
    file: Blob,
    onProgress: (p: number) => void,
  ): Promise<{ series: NormFrame[]; duration: number }> {
    this.series = [];

    // Point the shared callback at this processor for the duration of processing
    updatePoseCallback((r: Results) => {
      if (r.poseLandmarks) {
        const n = PoseNormalizer.normalize(r.poseLandmarks as any);
        if (n) this.series.push(n);
      }
      if (this.frameResolved) {
        const cb = this.frameResolved;
        this.frameResolved = null;
        cb();
      }
    });

    // Ensure the singleton exists
    if (!this.poseReady) await this.initPose();

    LOG("TemplateProcessor: processing video", { size: file.size, type: file.type });
    const video = await this.loadVideo(file);
    const duration = video.duration;
    const fps = 10, interval = 1 / fps, total = Math.floor(duration * fps);
    LOG("TemplateProcessor: video ready", { duration: duration.toFixed(2) + "s", totalFrames: total });
    const canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    let t = 0, fi = 0;
    while (t < duration) {
      await this.seekTo(video, t);
      ctx.drawImage(video, 0, 0, 480, 360);
      await this.sendFrame(canvas);
      onProgress(Math.round(((fi + 1) / total) * 100));
      t += interval; fi++;
      await new Promise(r => setTimeout(r, 10));
    }
    LOG("TemplateProcessor: extraction complete", {
      attempted: fi, extracted: this.series.length,
      landmarksPerFrame: this.series[0]?.length,
      idxType: this.series[0]?.length === 12 ? "FULL_BODY" : "UPPER_BODY",
    });
    if (this.series.length < 5)
      throw new Error("Could not detect body clearly. Ensure your full body is visible and well-lit.");
    return { series: this.series, duration };
  }

  private loadVideo(file: Blob): Promise<HTMLVideoElement> {
    return new Promise((res, rej) => {
      const v = document.createElement("video");
      v.preload = "auto"; v.muted = true; v.playsInline = true;
      v.onerror = () => rej(new Error("Failed to load video. Try MP4 format."));
      v.onloadedmetadata = async () => {
        LOG("TemplateProcessor: video metadata", { duration: v.duration, w: v.videoWidth, h: v.videoHeight });
        if (!isFinite(v.duration)) {
          WARN("TemplateProcessor: non-finite duration, seeking to end...");
          await new Promise<void>(r => { v.addEventListener("seeked", () => r(), { once: true }); v.currentTime = 1e10; });
        }
        res(v);
      };
      v.src = URL.createObjectURL(file); v.load();
    });
  }

  private seekTo(v: HTMLVideoElement, t: number): Promise<void> {
    return new Promise(res => {
      if (Math.abs(v.currentTime - t) < 0.05) return res();
      let done = false;
      const finish = () => { if (done) return; done = true; v.removeEventListener("seeked", finish); clearTimeout(to); res(); };
      v.addEventListener("seeked", finish);
      const to = setTimeout(finish, 2000);
      v.currentTime = t;
    });
  }

  private sendFrame(canvas: HTMLCanvasElement): Promise<void> {
    return new Promise(res => {
      let done = false;
      this.frameResolved = () => { if (done) return; done = true; res(); };
      const to = setTimeout(() => {
        if (done) return; done = true; this.frameResolved = null; res();
      }, 3000);
      sendToSharedPose(canvas).catch(() => {
        if (!done) { done = true; clearTimeout(to); this.frameResolved = null; res(); }
      });
    });
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
        LOG("parseTemplateFile: loaded", {
          name: t.name, frameCount: t.frameCount,
          landmarksPerFrame: t.frames[0]?.length,
          durationSeconds: t.durationSeconds,
        });
        res(t as ExerciseTemplate);
      } catch { rej(new Error("Invalid JSON template file")); }
    };
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsText(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE POSE PREVIEW — uses shared singleton
// ─────────────────────────────────────────────────────────────────────────────

const LivePosePreview = ({ onClose }: { onClose: () => void }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [status, setStatus]     = useState("Initializing pose model...");
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    LOG("LivePosePreview: mounting");

    (async () => {
      try {
        await getSharedPose((r: Results) => {
          if (cancelled) return;
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

        LOG("LivePosePreview: Pose ready");
        if (cancelled) return;

        const cam = new Camera(videoRef.current!, {
          onFrame: async () => {
            if (videoRef.current) await sendToSharedPose(videoRef.current);
          },
          width: 640, height: 480,
        });
        cameraRef.current = cam;
        await cam.start();
        LOG("LivePosePreview: camera started");
        if (!cancelled) setStatus("Stand back so your full body is visible");
      } catch (e: any) {
        ERR("LivePosePreview error:", e.message);
        if (!cancelled) setStatus("Error: " + e.message);
      }
    })();

    return () => {
      cancelled = true;
      cameraRef.current?.stop();
      // Clear callback so stale frames don't fire after unmount
      updatePoseCallback(() => {});
    };
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
// TEMPLATE TESTER — uses shared singleton
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateTesterProps { template: ExerciseTemplate; onClose: () => void; visible: boolean; }

const TemplateTester = ({ template, onClose, visible }: TemplateTesterProps) => {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  // No longer holds a Pose instance — we use the singleton
  const streamRef  = useRef<MediaStream | null>(null);
  const animRef    = useRef<number | null>(null);
  const stopRef    = useRef(false);
  const matcherRef = useRef<LiveMatcher | null>(null);
  const templateFramesRef = useRef<NormFrame[]>([]);
  const templateIdxRef    = useRef<number[]>(UPPER_BODY_IDX);
  const repCountRef       = useRef(0);
  const poseCallsRef      = useRef(0);
  const poseHitsRef       = useRef(0);

  const [testStage, setTestStage]     = useState<TestStage>("idle");
  const [status, setStatus]           = useState("Initializing pose model...");
  const [detected, setDetected]       = useState(false);
  const [similarity, setSimilarity]   = useState(0);
  const [repCount, setRepCount]       = useState(0);
  const [bestSim, setBestSim]         = useState(0);
  const [history, setHistory]         = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);

  // ── Shared results handler (rebuilt whenever template changes) ────────────
  const buildResultsHandler = useCallback(() => {
    return (r: Results) => {
      if (stopRef.current) return;
      poseCallsRef.current++;

      const c = canvasRef.current, v = videoRef.current;
      if (!c || !v) return;
      c.width  = v.videoWidth  || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);

      if (poseCallsRef.current % 30 === 1) {
        LOG("pose.onResults health", {
          total:         poseCallsRef.current,
          withLandmarks: poseHitsRef.current,
          noLandmarks:   poseCallsRef.current - poseHitsRef.current,
          videoSize:     `${c.width}x${c.height}`,
          matcher:       !!matcherRef.current,
        });
      }

      if (r.poseLandmarks && matcherRef.current) {
        poseHitsRef.current++;

        if (poseHitsRef.current === 1) {
          LOG("pose.onResults: FIRST landmark detection!", {
            count: r.poseLandmarks.length,
            lm11: { vis: r.poseLandmarks[11]?.visibility?.toFixed(3), x: r.poseLandmarks[11]?.x?.toFixed(3) },
            lm12: { vis: r.poseLandmarks[12]?.visibility?.toFixed(3), x: r.poseLandmarks[12]?.x?.toFixed(3) },
            lm23: { vis: r.poseLandmarks[23]?.visibility?.toFixed(3) },
          });
        }

        const res = matcherRef.current.processFrame(r.poseLandmarks as any);
        setSimilarity(res.similarity);
        setBestSim(prev => Math.max(prev, res.similarity));
        setHistory(prev => [...prev, res.similarity].slice(-60));
        setRepCount(res.repCount);
        setStatus(res.status);
        setDetected(true);

        const col = res.similarity >= 75 ? "#10b981" : res.similarity >= 45 ? "#f59e0b" : "#ef4444";
        drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: col, lineWidth: 3 });
        drawLandmarks(ctx, r.poseLandmarks, { color: "#fff", fillColor: col, radius: 5 });
      } else {
        if (r.poseLandmarks && !matcherRef.current) {
          WARN("pose.onResults: landmarks detected but matcherRef is null!");
        }
        setDetected(false);
        setStatus("Stand back so your full body is visible");
      }
    };
  }, []); // no deps — uses refs only

  const stopLive = useCallback(() => {
    LOG("TemplateTester: stopLive");
    stopRef.current = true;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDetected(false);
    // Clear callback so stale frames don't fire
    updatePoseCallback(() => {});
  }, []);

  // Rebuild matcher when template changes
  useEffect(() => {
    LOG("TemplateTester: template changed →", template.name, {
      frameCount: template.frameCount,
      landmarksPerFrame: template.frames[0]?.length,
    });
    const frames = template.frames.map((f: number[][]) =>
      f.map(([x, y, z, v]) => ({ x, y, z, visibility: v ?? 1 }))
    );
    const landmarkIdx = PoseNormalizer.inferIdx(template.frames);
    LOG("TemplateTester: deserialised frames", { count: frames.length, landmarksPerFrame: frames[0]?.length, landmarkIdx });
    templateFramesRef.current = frames;
    templateIdxRef.current    = landmarkIdx;
    matcherRef.current = new LiveMatcher(frames, landmarkIdx);
  }, [template]);

  // Reset when hidden
  useEffect(() => {
    if (!visible) {
      LOG("TemplateTester: hidden — resetting");
      stopLive();
      setTestStage("idle"); setSimilarity(0); setBestSim(0); setRepCount(0); setHistory([]);
      matcherRef.current = new LiveMatcher(templateFramesRef.current, templateIdxRef.current);
      repCountRef.current = 0; poseCallsRef.current = 0; poseHitsRef.current = 0;
    }
  }, [visible, stopLive]);

  // Initialise shared Pose once on mount (just warms up the singleton)
  useEffect(() => {
    let cancelled = false;
    LOG("TemplateTester: mounting — warming up shared Pose...");

    (async () => {
      try {
        // Pass a no-op; the real handler is set in startTest()
        await getSharedPose(() => {});
        LOG("TemplateTester: shared Pose ready ✅");
        if (cancelled) return;
        setInitialized(true);
        setStatus("Ready — press Start Test to begin");
      } catch (e: any) {
        ERR("TemplateTester: Pose warm-up FAILED", e.message, e);
        if (!cancelled) setStatus("Failed to load pose model: " + e.message);
      }
    })();

    return () => {
      cancelled = true;
      stopRef.current = true;
      LOG("TemplateTester: unmounting");
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
      // Do NOT close the shared pose — just clear callback
      updatePoseCallback(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTest = useCallback(async () => {
    LOG("TemplateTester: startTest", {
      videoReady:   !!videoRef.current,
      matcherReady: !!matcherRef.current,
      templateLen:  templateFramesRef.current.length,
      landmarkIdx:  templateIdxRef.current,
    });
    if (!videoRef.current) {
      ERR("startTest aborted — video ref is null");
      return;
    }
    matcherRef.current?.reset();
    poseCallsRef.current = 0; poseHitsRef.current = 0;
    setSimilarity(0); setBestSim(0); setRepCount(0); setHistory([]); setDetected(false);
    setStatus("Starting camera..."); setTestStage("running");

    // Point the singleton at this tester's handler BEFORE opening the camera
    updatePoseCallback(buildResultsHandler());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      LOG("camera stream acquired", { tracks: stream.getVideoTracks().map(t => t.label) });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      LOG("video.play() resolved");
      stopRef.current = false;

      const sendLoop = async () => {
        if (stopRef.current) return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await sendToSharedPose(videoRef.current);
        }
        animRef.current = requestAnimationFrame(sendLoop);
      };
      animRef.current = requestAnimationFrame(sendLoop);
      setStatus("Stand back so your full body is visible");
    } catch (e: any) {
      ERR("camera error", e.message);
      setStatus("Camera error: " + e.message); setTestStage("idle");
    }
  }, [buildResultsHandler]);

  const stopTest = useCallback(() => {
    LOG("TemplateTester: stopTest", { poseCalls: poseCallsRef.current, withLandmarks: poseHitsRef.current });
    stopLive();
    setTestStage("done"); setStatus("Session complete");
  }, [stopLive]);

  const restartTest = useCallback(() => {
    LOG("TemplateTester: restartTest");
    stopLive();
    matcherRef.current = new LiveMatcher(templateFramesRef.current, templateIdxRef.current);
    repCountRef.current = 0; poseCallsRef.current = 0; poseHitsRef.current = 0;
    setTestStage("idle"); setSimilarity(0); setBestSim(0); setRepCount(0); setHistory([]);
    setStatus("Ready — press Start Test to begin");
  }, [stopLive]);

  const avgSim = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
  const simColor = similarity >= 75 ? "text-emerald-400" : similarity >= 45 ? "text-amber-400" : "text-red-400";
  const simBg    = similarity >= 75 ? "bg-emerald-500"  : similarity >= 45 ? "bg-amber-500"  : "bg-red-500";

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col" style={{ display: visible ? "flex" : "none" }}>
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
        <div className="relative flex-1 bg-black overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)", display: testStage === "running" ? "block" : "none" }} autoPlay playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10"
            style={{ transform: "scaleX(-1)", display: testStage === "running" ? "block" : "none" }} />

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
                      { label: "Best", val: bestSim + "%",       col: "text-emerald-400" },
                      { label: "Avg",  val: avgSim + "%",        col: "text-teal-400" },
                    ].map(({ label, val, col }) => (
                      <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center min-w-[90px]">
                        <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${col}`}>{label}</p>
                        <p className="text-white font-black text-3xl">{val}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm max-w-xs">
                    {repCount >= 3 && bestSim >= 75 ? "🎉 Great session! Template is working perfectly."
                      : repCount > 0               ? "✅ Reps detected. Adjust threshold if needed."
                      : bestSim >= 50              ? "⚠️ Good similarity but no reps. Complete full movements."
                      : "❌ Low match. Re-record with full body clearly visible."}
                  </p>
                  <button onClick={restartTest} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors mx-auto">
                    <RefreshCcw size={16} /> Test Again
                  </button>
                </div>
              )}
            </div>
          )}

          {testStage === "running" && (<>
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

            <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-6">
              <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs font-semibold">DTW Similarity</span>
                  <span className={`text-xs font-bold ${simColor}`}>{similarity}%</span>
                </div>
                <div className="relative w-full bg-slate-700/60 rounded-full h-3 overflow-visible">
                  <div className={`h-full rounded-full transition-all duration-200 ${simBg}`} style={{ width: `${similarity}%` }} />
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
              <div className="bg-slate-700/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-0.5">Landmark Set</p>
                <p className="text-white text-xs font-semibold">
                  {template.frames[0]?.length === FULL_BODY_IDX.length ? "Full Body (12)" : "Upper Body (6)"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Live Stats</p>
            <div className="space-y-3">
              {[
                { label: "DTW Match",    val: testStage === "running" ? similarity + "%" : "–", color: simColor },
                { label: "Reps Counted", val: String(repCount),   color: "text-violet-400" },
                { label: "Best Match",   val: bestSim > 0 ? bestSim + "%" : "–", color: "text-teal-400" },
                { label: "Avg Match",    val: avgSim > 0  ? avgSim + "%"  : "–", color: "text-slate-300" },
                { label: "Frames Seen",  val: String(history.length), color: "text-slate-300" },
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
                { label: "Rep counted",   range: "≥ 72%",  color: "bg-emerald-500" },
                { label: "Good movement", range: "45–71%", color: "bg-amber-500" },
                { label: "Low match",     range: "< 45%",  color: "bg-red-500" },
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
              <p className="text-slate-400 text-xs leading-relaxed">Dynamic Time Warping compares your full movement <em>sequence</em> to the template, tolerating speed differences. A rep is counted when similarity ≥ 72%.</p>
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
  const navigate   = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";

  const [exerciseName, setExerciseName] = useState("");
  const [exerciseDesc, setExerciseDesc]  = useState("");
  const [category, setCategory]         = useState("Full Body");
  const [stage, setStage]               = useState<Stage>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [progress, setProgress]         = useState(0);
  const [errorMsg, setErrorMsg]         = useState("");
  const [template, setTemplate]         = useState<ExerciseTemplate | null>(null);
  const [showLiveTest, setShowLiveTest]                   = useState(false);
  const [showTemplateTester, setShowTemplateTester]       = useState(false);
  const [recordingTime, setRecordingTime]                 = useState(0);
  const [loadedTestTemplate, setLoadedTestTemplate]       = useState<ExerciseTemplate | null>(null);
  const [loadTemplateError, setLoadTemplateError]         = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError]   = useState("");

  const testFileInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef     = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const processorRef     = useRef(new TemplateProcessor());
  const streamRef        = useRef<MediaStream | null>(null);
  const timerRef         = useRef<number | null>(null);
  const liveCanvasRef    = useRef<HTMLCanvasElement>(null);
  const recAnimRef       = useRef<number | null>(null);
  const recCancelRef     = useRef(false);
  const [recordingDetected, setRecordingDetected] = useState(false);

  useEffect(() => {
    if (stage === "recording") {
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const stopRecordingSkeleton = () => {
    recCancelRef.current = true;
    if (recAnimRef.current) { cancelAnimationFrame(recAnimRef.current); recAnimRef.current = null; }
    // Do NOT close the shared pose — just clear callback
    updatePoseCallback(() => {});
    setRecordingDetected(false);
    if (liveCanvasRef.current) liveCanvasRef.current.getContext("2d")?.clearRect(0, 0, liveCanvasRef.current.width, liveCanvasRef.current.height);
  };

  const startRecording = async () => {
  LOG("CreateExercise: startRecording");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    streamRef.current = stream; chunksRef.current = [];
    if (liveVideoRef.current) { liveVideoRef.current.srcObject = stream; liveVideoRef.current.play(); }
    const mimeType = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";
    LOG("recording mimeType:", mimeType || "(browser default)");
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stopRecordingSkeleton();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      LOG("recording stopped", { blobSize: blob.size, blobType: blob.type, chunks: chunksRef.current.length });
      stream.getTracks().forEach(t => t.stop()); streamRef.current = null;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
      const url = URL.createObjectURL(blob);
      if (playbackVideoRef.current) { playbackVideoRef.current.src = url; playbackVideoRef.current.controls = true; }
      setRecordedBlob(blob); setStage("recorded");
    };
    recorder.start(1000); mediaRecorderRef.current = recorder; setStage("recording");
    recCancelRef.current = false;

    (async () => {
      try {
        // 1. Ensure singleton is warm — pass no-op, we set real callback below
        await getSharedPose(() => {});

        if (recCancelRef.current) return;

        // 2. NOW set the real skeleton callback AFTER getSharedPose resolves
        //    so it is never overwritten
        updatePoseCallback((r: Results) => {
          if (recCancelRef.current) return;
          const c = liveCanvasRef.current, v = liveVideoRef.current;
          if (!c || !v) return;
          c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
          const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);
          if (r.poseLandmarks) {
            drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS, { color: "#14b8a6", lineWidth: 3 });
            drawLandmarks(ctx, r.poseLandmarks, { color: "#fff", fillColor: "#14b8a6", radius: 5 });
            setRecordingDetected(true);
          } else { setRecordingDetected(false); }
        });

        // 3. Start send loop
        const sendLoop = async () => {
          if (recCancelRef.current) return;
          if (liveVideoRef.current && liveVideoRef.current.readyState >= 2) {
            await sendToSharedPose(liveVideoRef.current);
          }
          recAnimRef.current = requestAnimationFrame(sendLoop);
        };
        recAnimRef.current = requestAnimationFrame(sendLoop);
      } catch (skErr) { console.warn("Recording skeleton error:", skErr); }
    })();
  } catch (e: any) {
    ERR("camera access denied", e.message);
    setErrorMsg("Camera access denied: " + e.message); setStage("error");
  }
};

  const stopRecording = () => { LOG("stopRecording"); mediaRecorderRef.current?.stop(); };

  const saveToLibrary = async () => {
    if (!template) return;
    LOG("saveToLibrary", { name: template.name });
    const token = localStorage.getItem("token");
    setSaveStatus("saving"); setSaveError("");
    try {
      const res = await fetch("http://localhost:5000/doctor/custom-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: template.name, description: template.description, category: template.category, frameCount: template.frameCount, durationSeconds: template.durationSeconds, frames: template.frames }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message ?? "Save failed"); }
      LOG("saved to library ✅");
      setSaveStatus("saved");
    } catch (e: any) { ERR("saveToLibrary failed", e.message); setSaveError(e.message ?? "Unknown error"); setSaveStatus("error"); }
  };

  const handleFileUpload = (file: File) => {
    LOG("handleFileUpload", { name: file.name, size: file.size, type: file.type });
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (playbackVideoRef.current) { playbackVideoRef.current.src = url; playbackVideoRef.current.controls = true; }
    setRecordedBlob(file); setStage("recorded");
  };

  const handleLoadTestTemplate = async (file: File) => {
    LOG("handleLoadTestTemplate", { name: file.name });
    setLoadTemplateError("");
    try { setLoadedTestTemplate(await parseTemplateFile(file)); }
    catch (e: any) { ERR("template parse error", e.message); setLoadTemplateError(e.message); }
  };

  const processVideo = async () => {
    if (!recordedBlob || !exerciseName.trim()) return;
    LOG("processVideo starting", { exerciseName, blobSize: recordedBlob.size });
    setStage("processing"); setProgress(0); setErrorMsg("");
    try {
      const { series, duration } = await processorRef.current.processVideo(recordedBlob, setProgress);
      const tmpl: ExerciseTemplate = {
        name: exerciseName.trim(), description: exerciseDesc.trim(), category,
        createdAt: new Date().toISOString(), frameCount: series.length,
        durationSeconds: Math.round(duration),
        frames: series.map((frame: any[]) => frame.map((lm: any) => [lm.x, lm.y, lm.z, lm.visibility ?? 1])),
      };
      LOG("template created ✅", { frameCount: tmpl.frameCount, landmarksPerFrame: tmpl.frames[0]?.length, idxType: tmpl.frames[0]?.length === 12 ? "FULL_BODY" : "UPPER_BODY" });
      setTemplate(tmpl); setStage("done");
    } catch (e: any) { ERR("processVideo failed", e.message); setErrorMsg(e.message || "Processing failed."); setStage("error"); }
  };

  const reset = () => {
    LOG("reset");
    stopRecordingSkeleton();
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    if (playbackVideoRef.current) { playbackVideoRef.current.src = ""; playbackVideoRef.current.controls = false; }
    setStage("idle"); setRecordedBlob(null); setProgress(0); setErrorMsg(""); setTemplate(null); setRecordingTime(0);
  };

  const canProcess = stage === "recorded" && exerciseName.trim().length > 0;
  const activeTestTemplate = template ?? loadedTestTemplate;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <div className="relative flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 via-slate-900 to-slate-900 pointer-events-none" />
        {showLiveTest && <LivePosePreview onClose={() => setShowLiveTest(false)} />}
        {activeTestTemplate && (
          <TemplateTester template={activeTestTemplate} visible={showTemplateTester} onClose={() => setShowTemplateTester(false)} />
        )}

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
              <div className="flex gap-3">
                <button onClick={startRecording} className="flex-1 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-5 py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-teal-900/40">
                  <Video size={20} /> Record
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold px-5 py-4 rounded-2xl transition-all active:scale-95">
                  <Upload size={20} /> Upload
                </button>
              </div>
              <button onClick={() => setShowLiveTest(true)} className="w-full flex items-center justify-center gap-2 border border-slate-600 hover:border-teal-500 hover:bg-teal-500/10 text-slate-300 hover:text-teal-300 font-semibold px-5 py-3 rounded-2xl transition-all">
                <Eye size={18} /> Test Camera & Pose Detection
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          </div>
        )}

        <video ref={liveVideoRef} className="absolute inset-0 w-full h-full object-cover" style={{ display: stage === "recording" ? "block" : "none" }} autoPlay playsInline muted />
        <canvas ref={liveCanvasRef} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" style={{ display: stage === "recording" ? "block" : "none" }} />
        <video ref={playbackVideoRef} className="absolute inset-0 w-full h-full object-contain" style={{ display: ["recorded", "processing", "done", "error"].includes(stage) ? "block" : "none" }} playsInline />

        {stage === "recording" && (
          <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-500/90 text-white text-sm font-bold px-4 py-2 rounded-full backdrop-blur-sm animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full" /> REC
            </div>
            <div className="bg-slate-900/80 backdrop-blur-sm text-white text-sm font-mono font-bold px-4 py-2 rounded-full">{formatTime(recordingTime)}</div>
            <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-full backdrop-blur-sm transition-colors ${recordingDetected ? "bg-teal-500/90 text-white" : "bg-slate-800/80 text-slate-400"}`}>
              <span className={`w-2 h-2 rounded-full ${recordingDetected ? "bg-white" : "bg-slate-500"}`} />
              {recordingDetected ? "Pose detected" : "Looking for body…"}
            </div>
          </div>
        )}
        {stage === "recording" && (
          <button onClick={stopRecording} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-red-500 hover:bg-red-400 text-white font-bold px-8 py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-red-900/40">
            <StopCircle size={22} /> Stop Recording
          </button>
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
            <CheckCircle2 size={18} /> Template ready — {template?.frameCount} frames · {template?.durationSeconds}s
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

      <div className="w-[420px] flex flex-col bg-white shadow-2xl overflow-y-auto">
        <nav className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shadow-md shadow-teal-200"><Activity size={16} strokeWidth={2.5} className="text-white" /></div>
            <span className="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600">PhysioCheck</span>
          </div>
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X size={18} /></button>
        </nav>

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
          </div>

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
              <Step number={1} label="Add reference video"    sublabel="Record or upload one clean repetition" done={stage !== "idle"}              active={stage === "idle"} />
              <Step number={2} label="Enter exercise name"    sublabel="Required before processing"            done={exerciseName.trim().length > 0} active={stage === "recorded" && !exerciseName.trim()} />
              <Step number={3} label="Generate pose template" sublabel="AI extracts body movement data"        done={stage === "done"}               active={stage === "processing"} />
              <Step number={4} label="Export JSON template"   sublabel="Save and assign to patients"           done={false}                          active={stage === "done"} />
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

          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center"><FlaskConical size={14} className="text-violet-600" /></div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Template Tester</p>
              <span className="text-[10px] bg-violet-100 text-violet-600 font-bold px-2 py-0.5 rounded-full">DTW + Reps</span>
            </div>

            {stage === "done" && template && (
              <div className="mb-3 bg-violet-50 border border-violet-100 rounded-2xl p-4">
                <p className="text-xs text-violet-700 font-semibold mb-0.5">Your template is ready to test!</p>
                <p className="text-xs text-violet-500 mb-3">DTW matching + automatic rep counting</p>
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

        <div className="p-6 border-t border-slate-100 space-y-3 bg-slate-50/50">
          {stage === "done" && (<>
            <button onClick={() => template && exportTemplate(template)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-base font-bold py-4 rounded-2xl shadow-lg shadow-teal-100 transition-all active:scale-95 flex items-center justify-center gap-3">
              <Download size={20} /> Export Template JSON
            </button>
            {saveStatus !== "saved" && (
              <button onClick={saveToLibrary} disabled={saveStatus === "saving"}
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
            {saveStatus === "error" && <p className="text-red-500 text-xs text-center">{saveError}</p>}
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
            <button onClick={processVideo} disabled={!canProcess}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-base font-bold py-4 rounded-2xl shadow-lg shadow-teal-100 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3">
              <Cpu size={20} /> Generate Template {canProcess && <ChevronRight size={18} />}
            </button>
            {stage === "idle"      && <p className="text-center text-xs text-slate-400">Add a video and enter an exercise name to continue</p>}
            {stage === "recording" && <p className="text-center text-xs text-slate-400">Recording in progress — stop when you've completed one rep</p>}
            {stage === "recorded" && !exerciseName.trim() && <p className="text-center text-xs text-amber-500 font-medium">↑ Enter an exercise name above to enable processing</p>}
            {stage === "error"     && <button onClick={reset} className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold py-3 rounded-2xl transition-colors text-sm">Try Again</button>}
          </>)}
        </div>
      </div>
    </div>
  );
};

export default CreateExercise;