import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Play, StopCircle, ChevronLeft, Activity, Repeat2, Zap, Expand, CheckCircle2, AlertCircle } from "lucide-react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import type { Results } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import type { Results as HandResults } from "@mediapipe/hands";
import * as faceapi from "face-api.js";

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
  static deserialise(raw: number[][]): NormFrame {
    return raw.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
  }
}

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
    return result;
  }

  private triggerCooldown() {
    this.isCooldown = true;
    setTimeout(() => { this.isCooldown = false; }, this.cooldownMs);
  }

  reset() {
    this.repCount = 0; this.currentTargetIndex = 0; this.isCooldown = false;
    this.buffer = [];
  }
}

interface StretchConfig { lm1: number; lm2: number; direction: "inward" | "outward"; }

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  exerciseMode: "workout" | "stretch";
  exerciseType: "body" | "palm";
  frameCount: number;
  durationSeconds: number;
  frames: number[][][];
  stretchConfig?: StretchConfig;
  videoUrl?: string;
  keyframeTimestamps?: number[];
}

// ── Posture analysis from raw landmarks ──────────────────────────────────────
// Returns { status, cue } based on MediaPipe landmark positions.
// Landmark indices: 11=L-shoulder, 12=R-shoulder, 23=L-hip, 24=R-hip,
//                  25=L-knee, 26=R-knee, 27=L-ankle, 28=R-ankle
function analysePosture(lms: any[]): { status: "correct" | "incorrect"; cue: string | null } {
  if (!lms || lms.length < 29) return { status: "correct", cue: null };

  const vis = (i: number) => (lms[i]?.visibility ?? 0) > 0.4;

  // ── Shoulder alignment (are shoulders level?) ──
  if (vis(11) && vis(12)) {
    const shoulderTilt = Math.abs(lms[11].y - lms[12].y);
    if (shoulderTilt > 0.06) {
      return { status: "incorrect", cue: "Level your shoulders" };
    }
  }

  // ── Spine alignment: shoulder midpoint vs hip midpoint ──
  if (vis(11) && vis(12) && vis(23) && vis(24)) {
    const shoulderMidX = (lms[11].x + lms[12].x) / 2;
    const hipMidX = (lms[23].x + lms[24].x) / 2;
    const lateralLean = Math.abs(shoulderMidX - hipMidX);
    if (lateralLean > 0.08) {
      return { status: "incorrect", cue: "Keep your back straight" };
    }
  }

  // ── Hip drop (one hip significantly lower) ──
  if (vis(23) && vis(24)) {
    const hipTilt = Math.abs(lms[23].y - lms[24].y);
    if (hipTilt > 0.06) {
      return { status: "incorrect", cue: "Keep your hips level" };
    }
  }

  // ── Knee cave (knees closer together than ankles — for squat-type moves) ──
  if (vis(25) && vis(26) && vis(27) && vis(28)) {
    const kneeWidth = Math.abs(lms[25].x - lms[26].x);
    const ankleWidth = Math.abs(lms[27].x - lms[28].x);
    if (kneeWidth < ankleWidth * 0.6) {
      return { status: "incorrect", cue: "Push knees outward" };
    }
  }

  // ── Forward head / neck tilt: nose vs shoulder midpoint ──
  if (vis(0) && vis(11) && vis(12)) {
    const noseX = lms[0].x;
    const shoulderMidX = (lms[11].x + lms[12].x) / 2;
    if (Math.abs(noseX - shoulderMidX) > 0.1) {
      return { status: "incorrect", cue: "Tuck your chin in" };
    }
  }

  return { status: "correct", cue: null };
}

// ── Emotion constants ────────────────────────────────────────────────────────
const STRAIN_EMOTIONS = ["angry", "sad", "fearful", "disgusted"];

const EMOTION_EMOJI: Record<string, string> = {
  happy: "😊",
  neutral: "😐",
  surprised: "😮",
  angry: "😠",
  sad: "😢",
  fearful: "😨",
  disgusted: "🤢",
};

// ── Component ────────────────────────────────────────────────────────────────
const PatientCustomExercise: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("id");

  const [assignment, setAssignment] = useState<any>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const templateRef = useRef<Template | null>(null);  // accessible inside initPose closure
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState(0);
  const [status, setStatus] = useState("Press Start to begin");
  const [repCount, setRepCount] = useState(0);

  // Stretch phase 2 state
  const [stretchDist, setStretchDist] = useState(0);       // normalised distance between lm1 & lm2
  const [bestStretchDist, setBestStretchDist] = useState<number | null>(null);
  const [holdSecs, setHoldSecs] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPhase2Ref = useRef(false);  // mutable mirror for onResults closure

  // ── Posture state (mirrors ExerciseSession) ───────────────────────────────
  const [postureStatus, setPostureStatus] = useState<"correct" | "incorrect">("correct");
  const [formCue, setFormCue] = useState<string | null>(null);

  // ── Emotion state ─────────────────────────────────────────────────────────
  const [strainEmotion, setStrainEmotion] = useState<string | null>(null);

  // ── Form Score Tracking ───────────────────────────────────────────────────
  const similaritySumRef = useRef(0);
  const similarityCountRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const stopRef = useRef(false);
  const matcherRef = useRef<LiveMatcher | null>(null);
  const templateFramesRef = useRef<any[][]>([]);
  const dingAudioRef = useRef(new Audio("/ding.mp3"));
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const [currentTargetIdx, setCurrentTargetIdx] = useState(0);

  // ── Emotion / audio refs ──────────────────────────────────────────────────
  const emotionModelLoaded = useRef(false);
  const lastAudioTimeRef = useRef(0);
  const frameCounterRef = useRef(0);
  const isActiveRef = useRef(false);
  const matchSimilarityRef = useRef(0);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // ── Load assignment + template ────────────────────────────────────────────
  useEffect(() => {
    if (!assignmentId) { setError("No assignment ID"); setLoadingData(false); return; }
    const token = localStorage.getItem("token");

    const load = async () => {
      try {
        const assignRes = await fetch(`http://localhost:5000/patient/assignment/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!assignRes.ok) throw new Error("Failed to load assignment");
        const assignData = await assignRes.json();
        const assign = assignData.assignment;
        setAssignment(assign);

        const tmplId = assign.customTemplateId;
        if (!tmplId) throw new Error("This assignment does not have a custom exercise template");

        const tmplRes = await fetch(`http://localhost:5000/patient/custom-template/${tmplId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tmplRes.ok) throw new Error("Failed to load exercise template");
        const tmplData = await tmplRes.json();
        setTemplate(tmplData.template);
        templateRef.current = tmplData.template;

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

  // ── Load face-api emotion models ──────────────────────────────────────────
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

  // ── Timer removed (unused) ────────────────────────────────────────────────

  // ── Audio warning ─────────────────────────────────────────────────────────
  const triggerAudioWarning = useCallback(() => {
    const now = Date.now();
    if (now - lastAudioTimeRef.current < 8000) return;
    lastAudioTimeRef.current = now;
    const msg = new SpeechSynthesisUtterance(
      "Please do not pressure yourself. Take it slow."
    );
    msg.rate = 0.9; msg.pitch = 1; msg.volume = 1;
    window.speechSynthesis.speak(msg);
  }, []);
  const initPose = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !templateRef.current) return;
    const canvas = canvasRef.current;
    let ctx = canvas.getContext("2d")!;
    const dingAudio = dingAudioRef.current;

    const isStretch = templateRef.current.exerciseMode === "stretch";
    const isPalm = templateRef.current.exerciseType === "palm" || templateRef.current.name.toLowerCase().includes("palm");
    const runHands = isPalm || isStretch;
    const runPose = !isPalm || isStretch;

    let hands: Hands | null = null;
    let pose: Pose | null = null;

    // We need a way to combine landmarks for stretch phase 2
    let latestPoseLms: any[] | null = null;
    let latestHandLms: any[] | null = null;

    const processPhase2 = () => {
      if (!isPhase2Ref.current) return;
      const sc = templateRef.current?.stretchConfig;
      if (!sc) return;

      const sourceLms = isPalm ? latestHandLms : latestPoseLms;

      if (sourceLms && sourceLms[sc.lm1] && sourceLms[sc.lm2]) {
        const p1 = sourceLms[sc.lm1], p2 = sourceLms[sc.lm2];
        const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        setStretchDist(dist);
        setBestStretchDist(prev =>
          sc.direction === "inward"
            ? (prev === null ? dist : Math.min(prev, dist))
            : (prev === null ? dist : Math.max(prev, dist))
        );
        const progress = sc.direction === "inward" ? Math.max(0, 1 - dist / 0.4) : Math.min(1, dist / 0.4);
        setStatus(`Stretch ${Math.round(progress * 100)}% — ${sc.direction === "inward" ? "bring closer" : "spread apart"}`);

        // Highlight
        [sc.lm1, sc.lm2].forEach(idx => {
          const lm = sourceLms[idx];
          if (!lm) return;
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 14, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(250,204,21,0.5)";
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 3;
          ctx.fill();
          ctx.stroke();
        });
      }
    };

    const handlePoseResults = (results: Results) => {
      if (results.poseLandmarks) {
        latestPoseLms = results.poseLandmarks as any[] | null;
        // ── DTW match ──
        const norm = PoseNormalizer.normalize(results.poseLandmarks as any);
        if (norm && matcherRef.current && (!runHands || !isPalm)) {
          const res = matcherRef.current.processFrame(norm);
          matchSimilarityRef.current = res.similarity;

          if (res.similarity > 0) {
            similaritySumRef.current += res.similarity;
            similarityCountRef.current += 1;
          }

          setSimilarity(res.similarity);
          setStatus(res.status);
          setCurrentTargetIdx(matcherRef.current.currentTargetIndex);

          if (templateRef.current?.exerciseMode === "stretch" && res.repCount > 0 && !isPhase2Ref.current) {
            isPhase2Ref.current = true; setHoldSecs(0);
            holdTimerRef.current = setInterval(() => setHoldSecs(s => s + 1), 1000);
            setStatus("Keyframe matched! Now hold the stretch.");
          } else if (res.repCount > repCount) {
            setRepCount(res.repCount);
            dingAudio.currentTime = 0; dingAudio.play().catch(() => { });
          }

          const col = res.similarity >= 75 ? "#10b981" : res.similarity >= 45 ? "#f59e0b" : "#94a3b8";
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: col, lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
        } else {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#14b8a6", lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
        }

        // ── Posture analysis ──
        const posture = analysePosture(results.poseLandmarks as any);
        setPostureStatus(posture.status);
        setFormCue(posture.cue);
      }
      processPhase2();
    };

    if (runPose) {
      pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
      pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      pose.onResults(handlePoseResults);
      await pose.initialize();
    }

    if (runHands) {
      hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults((r: HandResults) => {
        if (stopRef.current) return;
        const c = canvasRef.current;
        if (!c) return;
        const ctxH = c.getContext("2d")!;
        latestHandLms = r.multiHandLandmarks?.[0] || null;
        if (r.multiHandLandmarks && r.multiHandLandmarks.length > 0) {
          for (const handLms of r.multiHandLandmarks) {
            drawConnectors(ctxH, handLms, HAND_CONNECTIONS, { color: "#a78bfa", lineWidth: 3 });
            drawLandmarks(ctxH, handLms, { color: "#fff", fillColor: "#a78bfa", radius: 5 });
          }
          if (!runPose || isPalm) {
            const norm = HandNormalizer.normalize(r.multiHandLandmarks[0]);
            if (norm && matcherRef.current && !isPhase2Ref.current) {
              const res = matcherRef.current.processFrame(norm);

              if (res.similarity > 0) {
                similaritySumRef.current += res.similarity;
                similarityCountRef.current += 1;
              }

              setSimilarity(res.similarity); setStatus(res.status);
              setCurrentTargetIdx(matcherRef.current.currentTargetIndex);
              if (res.repCount > repCount) { setRepCount(res.repCount); dingAudio.currentTime = 0; dingAudio.play().catch(() => { }); }
            } else if (!norm && matcherRef.current && !isPhase2Ref.current) {
              setStatus(matcherRef.current.processFrame(null).status);
            }
          }
        } else if (!runPose && matcherRef.current && !isPhase2Ref.current) {
          setStatus(matcherRef.current.processFrame(null).status);
        }
        processPhase2();
      });
      await hands.initialize();
    }

    stopRef.current = false;
    poseRef.current = (pose || hands) as unknown as Pose;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }

      const sendLoop = async () => {
        if (stopRef.current) return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const c = canvasRef.current, v = videoRef.current;
          if (c && v) {
            c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          }
          const promises = [];
          if (pose) promises.push(pose.send({ image: videoRef.current }));
          if (hands) promises.push(hands.send({ image: videoRef.current }));
          await Promise.all(promises);

          // ── Emotion detection every 10 frames ──
          frameCounterRef.current++;
          if (emotionModelLoaded.current && frameCounterRef.current % 10 === 0 && isActiveRef.current) {
            try {
              const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
              if (detection?.expressions) {
                const dominantEmotion = Object.entries(detection.expressions as any).sort((a: any, b: any) => (b[1] as number) - (a[1] as number))[0][0];
                setStrainEmotion(dominantEmotion);
                const { angry, sad, fearful } = detection.expressions as any;
                const strainScore = (angry ?? 0) + (sad ?? 0) + (fearful ?? 0);
                if (strainScore > 0.8 && matchSimilarityRef.current < 50) { triggerAudioWarning(); }
              }
            } catch (err) { console.warn("Emotion detection error", err); }
          }
        }
        animRef.current = requestAnimationFrame(sendLoop);
      };
      animRef.current = requestAnimationFrame(sendLoop);
    } catch (e: any) { alert("Camera error: " + e.message); }
  }, [repCount, triggerAudioWarning]);

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

      similaritySumRef.current = 0;
      similarityCountRef.current = 0;
      matcherRef.current = new LiveMatcher(templateFramesRef.current);
      setRepCount(0); isPhase2Ref.current = false;
      setBestStretchDist(null); setHoldSecs(0); setStretchDist(0);
      setSimilarity(0);
      setStrainEmotion(null);
      setPostureStatus("correct");
      setFormCue(null);
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
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    poseRef.current?.close(); poseRef.current = null;
    setIsActive(false);
    setStrainEmotion(null);
    setPostureStatus("correct");
    setFormCue(null);
    window.speechSynthesis.cancel();
    setStatus("Session stopped");

    const averageSimilarity = similarityCountRef.current > 0
      ? Math.round(similaritySumRef.current / similarityCountRef.current)
      : 0;

    try {
      await fetch("http://localhost:5000/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          reps: repCount,
          formScore: averageSimilarity
        }),
      });
    } catch (e) {
      console.error("Failed to complete session", e);
    }

    const isStretch = template?.exerciseMode === "stretch";
    alert(
      isStretch
        ? `Session complete!\n\nBest stretch: ${bestStretchDist !== null ? (bestStretchDist * 100).toFixed(0) + "% range" : "N/A"}\nHold time: ${holdSecs}s`
        : `Session complete!\n\nReps: ${repCount}\nForm Score: ${averageSimilarity}%`
    );
    navigate("/patient");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const simColour = (s: number) =>
    s >= 75 ? "text-emerald-400" : s >= 45 ? "text-yellow-400" : "text-slate-400";
  const isStrainEmotion = strainEmotion ? STRAIN_EMOTIONS.includes(strainEmotion) : false;

  // ── Video sync removed to allow continuous playback ──────────────────────────
  // The user requested a "normal video" experience.

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
        <button onClick={() => navigate("/patient")} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold transition">
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
          playsInline muted autoPlay
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

        {/* ── Posture / form cue overlay — top centre (same as ExerciseSession) ── */}
        {isActive && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
            <div className={`flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-all duration-300 ${postureStatus === "correct"
              ? "bg-teal-500/20 border-teal-400/50 text-teal-300"
              : "bg-red-500/20 border-red-400/50 text-red-300"
              }`}>
              {postureStatus === "correct" ? (
                <>
                  <CheckCircle2 size={22} fill="currentColor" />
                  <span className="font-bold tracking-wide">Posture Correct</span>
                </>
              ) : (
                <>
                  <AlertCircle size={22} fill="currentColor" />
                  <span className="font-bold tracking-wide uppercase">
                    {formCue ?? "Check your form"}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Emotion badge — top-right ── */}
        {isActive && strainEmotion && (
          <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold backdrop-blur-sm border transition-all ${isStrainEmotion
            ? "bg-red-500/20 border-red-500/40 text-red-300"
            : "bg-slate-800/80 border-slate-700 text-slate-300"
            }`}>
            <span className="text-lg leading-none">{EMOTION_EMOJI[strainEmotion] ?? "😐"}</span>
            <span className="capitalize">{strainEmotion}</span>
            {isStrainEmotion && (
              <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold">Strain</span>
            )}
          </div>
        )}

        {/* ── Similarity overlay — bottom centre ── */}
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
      <div className="w-full md:w-[400px] bg-slate-800 border-l border-slate-700 flex flex-col overflow-y-auto">
        {/* Reference Video */}
        {template?.videoUrl ? (
          <div className="p-4 border-b border-slate-700 bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Reference Performance</p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded-full text-[9px] font-black uppercase">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" /> Looping Demo
              </div>
            </div>
            <div className="relative group">
              <video
                ref={refVideoRef}
                src={template.videoUrl.startsWith('http') ? template.videoUrl : `http://localhost:5000${template.videoUrl}`}
                className="w-full aspect-video rounded-xl bg-black shadow-2xl border border-slate-700"
                muted
                playsInline
                autoPlay
                loop
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                <p className="text-white text-[10px] font-bold uppercase tracking-wider">Example Repetition</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                <p className="text-slate-500 text-[9px] font-bold uppercase mb-0.5">Target Pos</p>
                <p className="text-white font-black text-sm">{currentTargetIdx + 1} / {template.frameCount}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                <p className="text-slate-500 text-[9px] font-bold uppercase mb-0.5">Video Sync</p>
                <p className="text-teal-400 font-black text-sm">{template.keyframeTimestamps?.[currentTargetIdx]?.toFixed(1)}s</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-3 border-b border-slate-700">
            <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-50">
              <Activity size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm font-medium">No reference video available for this exercise.</p>
          </div>
        )}

        <div className="p-6 border-b border-slate-700">
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
          {template?.exerciseMode === "stretch" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Expand size={16} />
                  <span>Best Stretch</span>
                </div>
                <span className={`font-black text-xl ${bestStretchDist !== null ? "text-violet-400" : "text-slate-500"}`}>
                  {bestStretchDist !== null ? `${(bestStretchDist * 100).toFixed(0)}%` : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Activity size={16} />
                  <span>Hold Time</span>
                </div>
                <span className="font-black text-xl text-teal-400">
                  {holdSecs}s
                </span>
              </div>
              {/* Progress bar for stretch */}
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-violet-500 to-fuchsia-400"
                  style={{ width: `${Math.min(100, Math.max(0, stretchDist * 100))}%` }}
                />
              </div>
            </>
          ) : (
            <>
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

              {/* Progress bar for reps */}
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-400"
                  style={{ width: `${Math.min(100, (repCount / Math.max(targetReps, 1)) * 100)}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Posture cue card (sidebar) ── */}
        {isActive && (
          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border transition-all ${postureStatus === "correct"
            ? "bg-teal-500/10 border-teal-500/30"
            : "bg-red-500/10 border-red-500/30"
            }`}>
            {postureStatus === "correct" ? (
              <CheckCircle2 size={20} className="text-teal-400 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-red-400 shrink-0" />
            )}
            <div>
              <p className="text-xs uppercase tracking-wide font-bold mb-0.5 text-slate-400">Form</p>
              <p className={`text-sm font-semibold ${postureStatus === "correct" ? "text-teal-300" : "text-red-300"}`}>
                {postureStatus === "correct" ? "Posture Correct" : (formCue ?? "Check your form")}
              </p>
            </div>
          </div>
        )}

        {/* ── Expression card (sidebar) ── */}
        {isActive && strainEmotion && (
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between border transition-all ${isStrainEmotion
            ? "bg-red-500/10 border-red-500/30"
            : "bg-slate-800 border-slate-700"
            }`}>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Expression</p>
              <p className={`font-semibold capitalize text-sm ${isStrainEmotion ? "text-red-300" : "text-emerald-300"}`}>
                {strainEmotion}
              </p>
              {isStrainEmotion && (
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-0.5">
                  Strain detected
                </p>
              )}
            </div>
            <span className="text-3xl">{EMOTION_EMOJI[strainEmotion] ?? "😐"}</span>
          </div>
        )}

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