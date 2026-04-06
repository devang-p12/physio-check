import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Play, StopCircle, ChevronLeft, Activity, Zap, Expand,
  CheckCircle2, AlertCircle, X, Send, Bot, User, Loader2,
  TrendingUp, ChevronRight, Sparkles, Clock,
} from "lucide-react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import type { Results } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import type { Results as HandResults } from "@mediapipe/hands";
import * as faceapi from "face-api.js";
import { CustomExerciseCounter } from "../exercise-engine/repCounter/customExerciseCounter";
import type { RawLandmark } from "../exercise-engine/types";

// ───────────────────────────────────────────────────────────────────────────────
interface NormLandmark { x: number; y: number; z: number; visibility: number; }
type NormFrame = NormLandmark[];

const FULL_BODY_IDX = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const UPPER_BODY_IDX = [11, 12, 13, 14, 15, 16];
const LOWER_CHECK = [23, 24, 25, 26];

// ─── Threshold configuration ──────────────────────────────────────────────────
/**
 * LANDMARK_DISTANCE_STRONG  — per-landmark distance for a "strong" match (green).
 *   Normalised units where shoulder-width = 1.0.
 *   0.09 means each landmark must be within 9% of shoulder-width from template.
 *
 * LANDMARK_DISTANCE_SOFT    — per-landmark distance for a "soft / tolerated" match (amber).
 *   Still counts toward session accuracy; catches small misalignments.
 *
 * WEIGHTED_PASS_STRONG      — fraction (0–1) of total landmark WEIGHT that must
 *   pass the STRONG distance threshold for an overall STRONG match.
 *   e.g. 0.75 → ≥75% of weighted landmark mass must be within STRONG distance.
 *
 * WEIGHTED_PASS_SOFT        — same but for SOFT threshold.
 *
 * SMOOTHING_WINDOW          — frames in the rolling ring before threshold check.
 */
const LANDMARK_DISTANCE_STRONG = 0.09;
const LANDMARK_DISTANCE_SOFT   = 0.18;
const WEIGHTED_PASS_STRONG     = 0.75;
const WEIGHTED_PASS_SOFT       = 0.55;
const SMOOTHING_WINDOW         = 10;

// ─── Per-landmark importance weights (Pose) ───────────────────────────────────
/**
 * Applied to each landmark by its MediaPipe index.
 * Critical joints (shoulders=11/12, hips=23/24) get weight 3 — meaning a wrong
 * shoulder position has 3× the impact of a misaligned wrist (weight 1).
 * This prevents a correct wrist from "covering" for a wrong shoulder.
 *
 * Index map:
 *   11=L-shoulder, 12=R-shoulder, 13=L-elbow, 14=R-elbow,
 *   15=L-wrist,    16=R-wrist,    23=L-hip,   24=R-hip,
 *   25=L-knee,     26=R-knee,     27=L-ankle, 28=R-ankle
 */
const LANDMARK_WEIGHTS: Record<number, number> = {
  11: 3, 12: 3,   // shoulders — highest priority
  23: 3, 24: 3,   // hips      — highest priority
  13: 2, 14: 2,   // elbows
  25: 2, 26: 2,   // knees
  15: 1, 16: 1,   // wrists
  27: 1, 28: 1,   // ankles
};

// ─── Per-landmark importance weights (Hands) ──────────────────────────────────
/**
 * Wrist (0) and MCP joints (5,9,13,17) define the hand shape most strongly.
 */
const HAND_LANDMARK_WEIGHTS: Record<number, number> = {
  0:  3,                          // wrist
  5: 2, 9: 2, 13: 2, 17: 2,      // MCP joints
  4: 1.5,                         // thumb tip
  6: 1.5, 10: 1.5, 14: 1.5, 18: 1.5, // PIP joints
  8: 1, 12: 1, 16: 1, 20: 1,     // fingertips
  1: 1, 2: 1, 3: 1,              // thumb intermediates
  7: 1, 11: 1, 15: 1, 19: 1,    // other intermediates
};

type MatchTier = "strong" | "soft" | "none";

// ─── Per-landmark detail ──────────────────────────────────────────────────────
interface LandmarkMatchDetail {
  index: number;
  distance: number;
  passedStrong: boolean;
  passedSoft: boolean;
  weight: number;
}

interface FrameMatchResult {
  weightedPassRateStrong: number;  // 0–1
  weightedPassRateSoft:   number;  // 0–1
  tier: MatchTier;
  displayScore: number;            // 0–100 (UI)
  details: LandmarkMatchDetail[];
}

// ─── Core: weighted per-landmark distance evaluation ─────────────────────────
/**
 * For each visible landmark pair (current vs template):
 *   1. Compute 3-D Euclidean distance (both frames already normalised).
 *   2. Skip if visibility < 0.3 in either frame (occluded joint).
 *   3. Look up importance weight for this landmark index.
 *   4. Accumulate weighted PASS counts for STRONG and SOFT thresholds.
 *   5. Divide by total weight present → weighted pass rates (0–1).
 *
 * Why this beats a simple average distance:
 *   - A wrong shoulder (weight=3) fails the whole pose even if wrists are correct.
 *   - Occluded joints neither inflate nor deflate the score.
 *   - The two separate pass rates feed distinct UI tiers (green / amber / grey).
 */
function evaluateWeightedLandmarkMatch(
  current: NormFrame,
  template: NormFrame,
  weightMap: Record<number, number>,
  strongThreshold: number,
  softThreshold: number,
): FrameMatchResult {
  const n = Math.min(current.length, template.length);
  const details: LandmarkMatchDetail[] = [];

  let totalWeight       = 0;
  let weightedPassStrong = 0;
  let weightedPassSoft   = 0;

  for (let i = 0; i < n; i++) {
    const c = current[i];
    const t = template[i];
    if ((c.visibility ?? 1) < 0.3 || (t.visibility ?? 1) < 0.3) continue;

    const distance = Math.sqrt(
      (c.x - t.x) ** 2 +
      (c.y - t.y) ** 2 +
      (c.z - t.z) ** 2
    );

    const weight       = weightMap[i] ?? 1;
    const passedStrong = distance <= strongThreshold;
    const passedSoft   = distance <= softThreshold;

    details.push({ index: i, distance, passedStrong, passedSoft, weight });
    totalWeight += weight;
    if (passedStrong) weightedPassStrong += weight;
    if (passedSoft)   weightedPassSoft   += weight;
  }

  if (totalWeight === 0) {
    return { weightedPassRateStrong: 0, weightedPassRateSoft: 0, tier: "none", displayScore: 0, details: [] };
  }

  const weightedPassRateStrong = weightedPassStrong / totalWeight;
  const weightedPassRateSoft   = weightedPassSoft   / totalWeight;

  const tier: MatchTier =
    weightedPassRateStrong >= WEIGHTED_PASS_STRONG ? "strong" :
    weightedPassRateSoft   >= WEIGHTED_PASS_SOFT   ? "soft"   : "none";

  // Map soft pass rate → 0-100 for the UI display score
  const displayScore = Math.round(weightedPassRateSoft * 100);

  return { weightedPassRateStrong, weightedPassRateSoft, tier, displayScore, details };
}

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
      x: (lms[i].x - cx) / sw, y: (lms[i].y - cy) / sw, z: (lms[i].z - cz) / sw,
      visibility: lms[i].visibility ?? 1,
    }));
  }
}

class HandNormalizer {
  static normalize(lms: any[]): NormFrame | null {
    if (!lms || lms.length < 21) return null;
    const wrist = lms[0], midMcp = lms[9];
    const scale = Math.sqrt(
      (wrist.x - midMcp.x) ** 2 + (wrist.y - midMcp.y) ** 2 + (wrist.z - midMcp.z) ** 2
    );
    if (scale < 0.01) return null;
    return lms.map((lm) => ({
      x: (lm.x - wrist.x) / scale,
      y: (lm.y - wrist.y) / scale,
      z: (lm.z - wrist.z) / scale,
      visibility: lm.visibility ?? 1,
    }));
  }
}

// ─── LiveMatcher ──────────────────────────────────────────────────────────────
interface LiveMatchResult {
  displayScore: number;
  tier: MatchTier;
  status: string;
  details: LandmarkMatchDetail[];
}

class LiveMatcher {
  private template: NormFrame[];
  private weightMap: Record<number, number>;
  currentTargetIndex = 0;
  private isCooldown = false;
  private readonly cooldownMs = 1500;
  /**
   * Auto-Assist: when patient struggles > struggleTimeMs, the SOFT distance
   * threshold is relaxed (increased) in small steps up to maxRelaxedSoft.
   * Resets when matcher is reset().
   */
  public currentSoftThreshold = LANDMARK_DISTANCE_SOFT;
  private buffer: NormFrame[] = [];
  private lastTargetTime = Date.now();
  private readonly struggleTimeMs = 5000;
  private readonly maxRelaxedSoft = LANDMARK_DISTANCE_SOFT * 1.5;

  constructor(frames: NormFrame[], weightMap: Record<number, number>) {
    this.template = frames;
    this.weightMap = weightMap;
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
    const now = Date.now();
    if (!frame) {
      this.lastTargetTime = now;
      return { displayScore: 0, tier: "none", status: "Detecting body...", details: [] };
    }

    const avgVis = frame.reduce((acc, lm) => acc + (lm.visibility ?? 0), 0) / frame.length;
    const isVisible = avgVis > 0.4;

    this.buffer.push(frame);
    if (this.buffer.length > 5) this.buffer.shift();
    const smoothed = this.smooth(frame);

    if (this.isCooldown || this.template.length === 0) {
      this.lastTargetTime = now;
      return {
        displayScore: 0, tier: "none",
        status: this.isCooldown ? "Hold position..." : "Preparing...",
        details: [],
      };
    }

    // Auto-Assist: relax soft threshold if patient struggles
    if (isVisible && now - this.lastTargetTime > this.struggleTimeMs) {
      if (this.currentSoftThreshold < this.maxRelaxedSoft) {
        this.currentSoftThreshold = Math.min(this.maxRelaxedSoft, this.currentSoftThreshold + 0.02);
      }
      this.lastTargetTime = now;
    }

    const targetFrame = this.template[this.currentTargetIndex];

    // Evaluate across the buffer + smoothed frame; keep the BEST result
    // (highest weightedPassRateSoft) so momentary jitter doesn't drop the score.
    let bestResult: FrameMatchResult | null = null;
    for (const bf of [...this.buffer, smoothed]) {
      const result = evaluateWeightedLandmarkMatch(
        bf, targetFrame, this.weightMap,
        LANDMARK_DISTANCE_STRONG, this.currentSoftThreshold,
      );
      if (!bestResult || result.weightedPassRateSoft > bestResult.weightedPassRateSoft) {
        bestResult = result;
      }
    }

    if (!bestResult) {
      return { displayScore: 0, tier: "none", status: "Detecting body...", details: [] };
    }

    let status = `Match Position ${this.currentTargetIndex + 1} of ${this.template.length}`;

    // Advance on STRONG match — ensures only genuinely correct poses count as reps
    if (bestResult.weightedPassRateStrong >= WEIGHTED_PASS_STRONG) {
      this.currentTargetIndex++;
      this.lastTargetTime = now;
      if (this.currentTargetIndex >= this.template.length) {
        this.currentTargetIndex = 0;
        this.triggerCooldown();
        status = "✓ Full sequence matched!";
      } else {
        status = "✓ Hit! Move to next position.";
      }
    } else if (bestResult.weightedPassRateSoft >= WEIGHTED_PASS_SOFT) {
      // Identify the worst offending high-weight landmark for a targeted cue
      const worstFailing = bestResult.details
        .filter(d => !d.passedSoft)
        .sort((a, b) => (b.weight * b.distance) - (a.weight * a.distance))[0];
      status = worstFailing
        ? `Almost there! Adjust landmark ${worstFailing.index}`
        : "Getting closer...";
    }

    if (!isVisible) status = "⚠ Please move into frame";
    else if (this.currentSoftThreshold > LANDMARK_DISTANCE_SOFT) status += " (Auto-Assist active)";

    return { displayScore: bestResult.displayScore, tier: bestResult.tier, status, details: bestResult.details };
  }

  private triggerCooldown() {
    this.isCooldown = true;
    setTimeout(() => { this.isCooldown = false; }, this.cooldownMs);
  }

  reset() {
    this.currentTargetIndex = 0;
    this.isCooldown = false;
    this.buffer = [];
    this.currentSoftThreshold = LANDMARK_DISTANCE_SOFT;
    this.lastTargetTime = Date.now();
  }
}

interface StretchConfig { lm1: number; lm2: number; direction: "inward" | "outward"; }

interface Template {
  id: string; name: string; description: string; category: string;
  exerciseMode: "workout" | "stretch"; exerciseType: "body" | "palm";
  frameCount: number; durationSeconds: number; frames: number[][][];
  stretchConfig?: StretchConfig; videoUrl?: string; keyframeTimestamps?: number[];
}

function analysePosture(lms: any[]): { status: "correct" | "incorrect"; cue: string | null } {
  if (!lms || lms.length < 29) return { status: "correct", cue: null };
  const vis = (i: number) => (lms[i]?.visibility ?? 0) > 0.4;
  if (vis(11) && vis(12) && Math.abs(lms[11].y - lms[12].y) > 0.06)
    return { status: "incorrect", cue: "Level your shoulders" };
  if (vis(11) && vis(12) && vis(23) && vis(24)) {
    const sMidX = (lms[11].x + lms[12].x) / 2, hMidX = (lms[23].x + lms[24].x) / 2;
    if (Math.abs(sMidX - hMidX) > 0.08) return { status: "incorrect", cue: "Keep your back straight" };
  }
  if (vis(23) && vis(24) && Math.abs(lms[23].y - lms[24].y) > 0.06)
    return { status: "incorrect", cue: "Keep your hips level" };
  if (vis(25) && vis(26) && vis(27) && vis(28)) {
    const kw = Math.abs(lms[25].x - lms[26].x), aw = Math.abs(lms[27].x - lms[28].x);
    if (kw < aw * 0.6) return { status: "incorrect", cue: "Push knees outward" };
  }
  if (vis(0) && vis(11) && vis(12)) {
    const noseX = lms[0].x, sMidX = (lms[11].x + lms[12].x) / 2;
    if (Math.abs(noseX - sMidX) > 0.1) return { status: "incorrect", cue: "Tuck your chin in" };
  }
  return { status: "correct", cue: null };
}

const STRAIN_EMOTIONS = ["angry", "sad", "fearful", "disgusted"];
const EMOTION_EMOJI: Record<string, string> = {
  happy: "😊", neutral: "😐", surprised: "😮",
  angry: "😠", sad: "😢", fearful: "😨", disgusted: "🤢",
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST-SESSION CHATBOT
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionSummary {
  exerciseName: string;
  exerciseMode: "workout" | "stretch";
  correctPostureSeconds: number;
  allocatedDuration: number;
  postureAccuracy: number;
  avgDisplayScore: number;
  formScore: number;
  bestStretchDist?: number;
  helpThreshold?: number;
  painDetected?: boolean;
  dominantEmotion?: string | null;
}

interface ChatMessage { role: "user" | "assistant"; content: string; timestamp: Date; }

const QUICK_REPLIES = [
  "How can I improve my form?",
  "What muscles am I working?",
  "Does this exercise help with pain relief?",
  "How often should I do this?",
  "Am I ready to progress?",
];

function buildSystemPrompt(summary: SessionSummary, patient: any): string {
  const patientInfo = patient
    ? `Patient Details:
- Name: ${patient.name ?? "Patient"}
- Age: ${patient.age ?? "Unknown"}
- Condition/Diagnosis: ${patient.condition ?? patient.diagnosis ?? "Not specified"}
- Physiotherapist Notes: ${patient.notes ?? "None"}
- Pain/Strain Reported: ${summary.painDetected ? "YES (patient showed signs of strain)" : "No reported pain"}`
    : "Patient details unavailable.";

  const sessionInfo = `Exercise Session Summary:
- Exercise: ${summary.exerciseName} (${summary.exerciseMode === "stretch" ? "Stretch" : "Workout"})
- Session Duration: ${summary.allocatedDuration}s
- Time Matching Template: ${summary.correctPostureSeconds}s / ${summary.allocatedDuration}s
- Template Match Accuracy: ${summary.postureAccuracy}%
  (Each second counted if ≥${Math.round(WEIGHTED_PASS_SOFT * 100)}% of weighted landmark mass was within the soft distance threshold.
   Strong match = ≥${Math.round(WEIGHTED_PASS_STRONG * 100)}% within tight threshold — shown as green skeleton.
   Shoulders and hips are weighted 3×, elbows/knees 2×, wrists/ankles 1×.)
- Average Session Match Score: ${summary.avgDisplayScore}%
${summary.exerciseMode === "stretch" && summary.bestStretchDist != null
      ? `- Best Stretch Range: ${Math.round(summary.bestStretchDist * 100)}%` : ""}
${summary.dominantEmotion ? `- Dominant Emotion Detected: ${summary.dominantEmotion}` : ""}
${summary.helpThreshold && summary.helpThreshold > LANDMARK_DISTANCE_SOFT
      ? `- Note: Auto-Assist was active (soft distance threshold relaxed to ${summary.helpThreshold.toFixed(2)})` : ""}`;

  return `You are PhysioBot, a compassionate physiotherapy assistant in PhysioCheck.

${patientInfo}

${sessionInfo}

Your role:
1. Greet the patient by name and give a data-driven post-session recap.
2. Centre feedback on Template Match Accuracy. Green = strong match, amber = close match, both count.
3. Note the weighted scoring — critical joints (shoulders, hips) matter most.
4. Celebrate wins and give actionable advice without discouraging.
5. Provide advice tailored to their condition.
6. Answer follow-up questions about recovery, progression, and technique.
7. Always remind the patient to consult their physiotherapist for clinical decisions.
8. Keep responses concise and warm — max 150 words unless more detail is requested.
9. If the patient mentions pain, immediately prioritise safety.

Begin with a personalised post-session recap focused on template match accuracy.`;
}

interface PostSessionChatbotProps {
  isOpen: boolean; onClose: () => void; sessionSummary: SessionSummary;
}

const PostSessionChatbot: React.FC<PostSessionChatbotProps> = ({ isOpen, onClose, sessionSummary }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickRepliesVisible, setQuickRepliesVisible] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!isOpen || hasInitialized.current) return;
    hasInitialized.current = true;
    const init = async () => {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      let fetchedPatient = null;
      try {
        const res = await fetch("http://localhost:5000/patient/profile", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); fetchedPatient = d.patient ?? d.user ?? d; }
      } catch (e) { console.warn("Could not fetch patient profile:", e); }

      const prompt = buildSystemPrompt(sessionSummary, fetchedPatient);
      setSystemPrompt(prompt);
      try {
        const msg = await callGemini(prompt, [], "Hello! Please give me my post-session recap.");
        setMessages([{ role: "assistant", content: msg, timestamp: new Date() }]);
      } catch {
        setMessages([{
          role: "assistant",
          content: `Great work on your ${sessionSummary.exerciseName} session! You matched the template for ${sessionSummary.correctPostureSeconds}s — ${sessionSummary.postureAccuracy}% accuracy. Feel free to ask me anything!`,
          timestamp: new Date(),
        }]);
      }
      setQuickRepliesVisible(true);
      setIsLoading(false);
    };
    init();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) { hasInitialized.current = false; setMessages([]); setQuickRepliesVisible(false); setInput(""); }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setQuickRepliesVisible(false);
    setMessages(prev => [...prev, { role: "user", content: trimmed, timestamp: new Date() }]);
    setInput("");
    setIsLoading(true);
    try {
      const reply = await callGemini(systemPrompt, messages, trimmed);
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had trouble connecting. Please try again.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLoading, messages, systemPrompt]);

  if (!isOpen) return null;

  const grade =
    sessionSummary.postureAccuracy >= 80 ? { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" } :
    sessionSummary.postureAccuracy >= 60 ? { label: "Good",      color: "text-teal-400",    bg: "bg-teal-500/15 border-teal-500/30"    } :
    sessionSummary.postureAccuracy >= 40 ? { label: "Fair",      color: "text-yellow-400",  bg: "bg-yellow-500/15 border-yellow-500/30" } :
    { label: "Keep Trying", color: "text-slate-400", bg: "bg-slate-700/50 border-slate-600" };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg h-[90vh] max-h-[760px] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80"
          style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f1a2e 100%)" }}
          onClick={e => e.stopPropagation()}>

          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-slate-700/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-extrabold text-base leading-none">PhysioBot</h2>
                  <p className="text-teal-400 text-[11px] font-medium mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" /> AI Recovery Assistant
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-white transition">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/50 border border-slate-600/50">
                <Activity size={13} className="text-teal-400" />
                <span className="text-white text-xs font-semibold">{sessionSummary.exerciseName}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/50 border border-slate-600/50">
                <Clock size={13} className="text-violet-400" />
                <span className="text-white text-xs font-semibold">{sessionSummary.correctPostureSeconds}s / {sessionSummary.allocatedDuration}s matched</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${grade.bg}`}>
                <Sparkles size={13} className={grade.color} />
                <span className={`text-xs font-bold ${grade.color}`}>Template Match: {sessionSummary.postureAccuracy}% — {grade.label}</span>
              </div>
              {sessionSummary.exerciseMode === "stretch" && sessionSummary.bestStretchDist != null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30">
                  <TrendingUp size={13} className="text-fuchsia-400" />
                  <span className="text-fuchsia-300 text-xs font-semibold">Range: {Math.round(sessionSummary.bestStretchDist * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center ${msg.role === "assistant" ? "bg-gradient-to-br from-teal-500 to-emerald-600" : "bg-slate-600"}`}>
                  {msg.role === "assistant" ? <Bot size={14} className="text-white" /> : <User size={14} className="text-white" />}
                </div>
                <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "assistant" ? "bg-slate-700/60 border border-slate-600/50 text-slate-100 rounded-tl-sm" : "bg-teal-500 text-white rounded-tr-sm"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-700/60 border border-slate-600/50 flex items-center gap-1.5">
                  {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {quickRepliesVisible && !isLoading && (
            <div className="shrink-0 px-4 pb-2">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Suggested Questions</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.map(qr => (
                  <button key={qr} onClick={() => sendMessage(qr)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-700/70 border border-slate-600 hover:border-teal-500/60 hover:bg-slate-600/70 text-slate-300 hover:text-white text-xs font-medium transition-all">
                    <ChevronRight size={11} className="text-teal-400" />{qr}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="shrink-0 px-4 py-4 border-t border-slate-700/60">
            <div className="flex items-center gap-3 bg-slate-700/50 border border-slate-600/60 rounded-2xl px-4 py-2.5 focus-within:border-teal-500/50 transition">
              <input ref={inputRef} type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder="Ask about your recovery..."
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                disabled={isLoading} />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white transition-all active:scale-95">
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-600 mt-2">Powered by Gemini · Not a substitute for professional advice</p>
          </div>
        </div>
      </div>
    </>
  );
};

async function callGemini(sysPrompt: string, history: ChatMessage[], userMessage: string) {
  const contents = [
    { role: "user", parts: [{ text: sysPrompt }] },
    { role: "model", parts: [{ text: "Understood." }] },
    ...history.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  const token = localStorage.getItem("token");
  const res = await fetch("http://localhost:5000/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
  return (await res.json()).text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PatientCustomExercise: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("id");

  const [assignment, setAssignment] = useState<any>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const templateRef = useRef<Template | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayScore, setDisplayScore] = useState(0);        // smoothed 0–100
  const [matchTier, setMatchTier] = useState<MatchTier>("none");
  const [status, setStatus] = useState("Press Start to begin");
  const [repCount, setRepCount] = useState(0);
  const [repMatchScore, setRepMatchScore] = useState(0);
  const [repFeedback, setRepFeedback] = useState<string>("Waiting for template...");

  // ── Posture time tracking ─────────────────────────────────────────────────
  const [correctPostureSecs, setCorrectPostureSecs] = useState(0);
  const [totalSessionSecs, setTotalSessionSecs]     = useState(0);
  const correctPostureSecsRef = useRef(0);
  const totalSessionSecsRef   = useRef(0);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Smoothing ring buffers ────────────────────────────────────────────────
  // scoreRing: rolling window of raw displayScore values → average → smoothedScoreRef
  // tierRing:  rolling window of raw MatchTier values → majority vote → smoothedTierRef
  const scoreRingRef    = useRef<number[]>([]);
  const tierRingRef     = useRef<MatchTier[]>([]);
  const smoothedScoreRef = useRef(0);
  const smoothedTierRef  = useRef<MatchTier>("none");

  // Session-level running average for avgDisplayScore
  const scoreSumRef   = useRef(0);
  const scoreCountRef = useRef(0);

  // ── Stretch ───────────────────────────────────────────────────────────────
  const [stretchDist, setStretchDist]         = useState(0);
  const [bestStretchDist, setBestStretchDist] = useState<number | null>(null);

  // ── Alignment cue ─────────────────────────────────────────────────────────
  const [alignmentCue, setAlignmentCue] = useState<string | null>(null);

  // ── Emotion ───────────────────────────────────────────────────────────────
  const [strainEmotion, setStrainEmotion]   = useState<string | null>(null);
  const emotionCountsRef = useRef<Record<string, number>>({});

  // ── Pain ──────────────────────────────────────────────────────────────────
  const [painDetected, setPainDetected] = useState(false);
  const painReportedRef = useRef(false);

  // ── Chatbot ───────────────────────────────────────────────────────────────
  const [chatbotOpen, setChatbotOpen]           = useState(false);
  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const animRef     = useRef<number | null>(null);
  const stopRef     = useRef(false);
  const matcherRef  = useRef<LiveMatcher | null>(null);
  const templateFramesRef = useRef<NormFrame[]>([]);
  const [currentTargetIdx, setCurrentTargetIdx] = useState(0);
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const customCounterRef = useRef<CustomExerciseCounter | null>(null);
  const prevRepCountRef = useRef(0);

  const emotionModelLoaded = useRef(false);
  const lastAudioTimeRef   = useRef(0);
  const frameCounterRef    = useRef(0);
  const isActiveRef        = useRef(false);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const playBeep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.error("Audio error", e); }
  }, []);

  // ── Load assignment + template ────────────────────────────────────────────
  useEffect(() => {
    if (!assignmentId) { setError("No assignment ID"); setLoadingData(false); return; }
    const token = localStorage.getItem("token");
    (async () => {
      try {
        const aRes = await fetch(`http://localhost:5000/patient/assignment/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!aRes.ok) throw new Error("Failed to load assignment");
        const aData = await aRes.json();
        setAssignment(aData.assignment);
        const tmplId = aData.assignment.customTemplateId;
        if (!tmplId) throw new Error("This assignment does not have a custom exercise template");

        const tRes = await fetch(`http://localhost:5000/patient/custom-template/${tmplId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tRes.ok) throw new Error("Failed to load exercise template");
        const tData = await tRes.json();
        setTemplate(tData.template);
        templateRef.current = tData.template;

        let rawFrames: number[][][] = tData.template.frames;
        if (
          rawFrames.length === 1 && Array.isArray(rawFrames[0]) &&
          Array.isArray(rawFrames[0][0]) &&
          Array.isArray((rawFrames[0][0] as unknown as number[][])[0])
        ) rawFrames = rawFrames[0] as unknown as number[][][];

        const normFrames: NormFrame[] = rawFrames.map((f: number[][]) =>
          f.map(([x, y, z, v]) => ({ x, y, z, visibility: v ?? 1 }))
        );
        templateFramesRef.current = normFrames;

        const isPalm =
          tData.template.exerciseType === "palm" ||
          tData.template.name?.toLowerCase().includes("palm");
        matcherRef.current = new LiveMatcher(
          normFrames,
          isPalm ? HAND_LANDMARK_WEIGHTS : LANDMARK_WEIGHTS,
        );

        // Deterministic two-keyframe rep counter (uses first vs last keyframe)
        customCounterRef.current = new CustomExerciseCounter();
        customCounterRef.current.initFromTemplate(normFrames);
        prevRepCountRef.current = 0;
        setRepCount(0);
        setRepMatchScore(0);
        setRepFeedback("Ready");
      } catch (e: any) {
        setError(e.message ?? "Unknown error");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [assignmentId]);

  // ── Load face-api ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        emotionModelLoaded.current = true;
      } catch (e) { console.error("Emotion model load failed", e); }
    })();
  }, []);

  const triggerAudioWarning = useCallback(() => {
    const now = Date.now();
    if (now - lastAudioTimeRef.current < 8000) return;
    lastAudioTimeRef.current = now;
    const msg = new SpeechSynthesisUtterance("Please do not pressure yourself. Take it slow.");
    msg.rate = 0.9; msg.pitch = 1; msg.volume = 1;
    window.speechSynthesis.speak(msg);
  }, []);

  // ── Session timer ─────────────────────────────────────────────────────────
  // Uses smoothedTierRef (majority-vote tier) — counts a tick if tier !== "none".
  const startSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = setInterval(() => {
      totalSessionSecsRef.current += 1;
      setTotalSessionSecs(totalSessionSecsRef.current);
      if (smoothedTierRef.current !== "none") {
        correctPostureSecsRef.current += 1;
        setCorrectPostureSecs(correctPostureSecsRef.current);
      }
    }, 1000);
  }, []);

  const stopSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) { clearInterval(sessionTimerRef.current); sessionTimerRef.current = null; }
  }, []);

  // ── Central match result handler ──────────────────────────────────────────
  const handleMatchResult = useCallback((res: LiveMatchResult) => {
    // Score ring → rolling average
    scoreRingRef.current.push(res.displayScore);
    if (scoreRingRef.current.length > SMOOTHING_WINDOW) scoreRingRef.current.shift();
    const smoothedScore = Math.round(
      scoreRingRef.current.reduce((a, b) => a + b, 0) / scoreRingRef.current.length
    );
    smoothedScoreRef.current = smoothedScore;

    // Tier ring → majority vote (prevents a single jittery frame from toggling the UI)
    tierRingRef.current.push(res.tier);
    if (tierRingRef.current.length > SMOOTHING_WINDOW) tierRingRef.current.shift();
    const tierCounts = { strong: 0, soft: 0, none: 0 };
    for (const t of tierRingRef.current) tierCounts[t]++;
    const smoothedTier: MatchTier =
      tierCounts.strong >= tierCounts.soft && tierCounts.strong >= tierCounts.none ? "strong" :
      tierCounts.soft   >= tierCounts.none ? "soft" : "none";
    smoothedTierRef.current = smoothedTier;

    // Session running average
    if (res.displayScore > 0) {
      scoreSumRef.current   += res.displayScore;
      scoreCountRef.current += 1;
    }

    setDisplayScore(smoothedScore);
    setMatchTier(smoothedTier);
    setStatus(res.status);
    if (matcherRef.current) setCurrentTargetIdx(matcherRef.current.currentTargetIndex);
  }, []);

  // ── Pose / Hands init ─────────────────────────────────────────────────────
  const initPose = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !templateRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const isPalm =
      templateRef.current.exerciseType === "palm" ||
      templateRef.current.name.toLowerCase().includes("palm");
    const isStretch = templateRef.current.exerciseMode === "stretch";
    const runHands = isPalm || isStretch;
    const runPose  = !isPalm || isStretch;

    let pose: Pose | null = null;
    let hands: Hands | null = null;
    let latestPoseLms: any[] | null = null;
    let latestHandLms: any[] | null = null;

    const processStretch = () => {
      const sc = templateRef.current?.stretchConfig;
      if (!sc) return;
      const src = isPalm ? latestHandLms : latestPoseLms;
      if (src && src[sc.lm1] && src[sc.lm2]) {
        const p1 = src[sc.lm1], p2 = src[sc.lm2];
        const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        setStretchDist(dist);
        setBestStretchDist(prev =>
          sc.direction === "inward"
            ? (prev === null ? dist : Math.min(prev, dist))
            : (prev === null ? dist : Math.max(prev, dist))
        );
        [sc.lm1, sc.lm2].forEach(idx => {
          const lm = src[idx]; if (!lm) return;
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 14, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(250,204,21,0.5)"; ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3;
          ctx.fill(); ctx.stroke();
        });
      }
    };

    const handlePoseResults = (results: Results) => {
      if (results.poseLandmarks) {
        latestPoseLms = results.poseLandmarks as any[];
        const norm = PoseNormalizer.normalize(results.poseLandmarks as any);

        // Two-keyframe custom rep counter update
        if (customCounterRef.current) {
          const raw: RawLandmark[] = (results.poseLandmarks as unknown as Array<{ x: number; y: number; z: number; visibility?: number }>).map(
            (lm) => ({ x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })
          );
          const out = customCounterRef.current.updateFromLivePose(raw);
          setRepCount(out.reps);
          setRepMatchScore(out.matchScore);
          setRepFeedback(out.feedback);

          if (out.reps > prevRepCountRef.current) {
            prevRepCountRef.current = out.reps;
            playBeep();
          }
        }

        if (norm && matcherRef.current && (!runHands || !isPalm)) {
          const res = matcherRef.current.processFrame(norm);
          handleMatchResult(res);

          // Skeleton connector colour driven by the smoothed tier
          const connCol =
            smoothedTierRef.current === "strong" ? "#10b981"
            : smoothedTierRef.current === "soft"  ? "#f59e0b"
            : "#94a3b8";
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: connCol, lineWidth: 2 });

          // Per-landmark dot colour: green=passed strong, amber=passed soft only, red=failed
          const idxList = PoseNormalizer.isFullBody(latestPoseLms) ? FULL_BODY_IDX : UPPER_BODY_IDX;
          if (res.details.length > 0) {
            res.details.forEach((d, framePos) => {
              const lmIdx = idxList[framePos];
              if (lmIdx == null) return;
              const lm = results.poseLandmarks[lmIdx];
              if (!lm) return;
              const dotColor = d.passedStrong ? "#10b981" : d.passedSoft ? "#f59e0b" : "#ef4444";
              ctx.beginPath();
              ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
              ctx.fillStyle = dotColor;
              ctx.fill();
            });
          } else {
            drawLandmarks(ctx, results.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
          }
        } else {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#14b8a6", lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#ffffff", lineWidth: 1, radius: 3 });
        }

        const pa = analysePosture(results.poseLandmarks as any);
        setAlignmentCue(pa.status === "incorrect" ? (pa.cue ?? "Check your form") : null);
      }
      processStretch();
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
        const c = canvasRef.current; if (!c) return;
        const ctxH = c.getContext("2d")!;
        latestHandLms = r.multiHandLandmarks?.[0] || null;
        if (r.multiHandLandmarks?.length) {
          for (const hl of r.multiHandLandmarks) {
            drawConnectors(ctxH, hl, HAND_CONNECTIONS, { color: "#a78bfa", lineWidth: 3 });
          }
          if (!runPose || isPalm) {
            const norm = HandNormalizer.normalize(r.multiHandLandmarks[0]);
            if (norm && matcherRef.current) {
              const res = matcherRef.current.processFrame(norm);
              handleMatchResult(res);
              // Per-landmark colour for hands
              r.multiHandLandmarks[0].forEach((lm, i) => {
                const d = res.details.find(dd => dd.index === i);
                const dotColor = !d ? "#ffffff"
                  : d.passedStrong ? "#10b981"
                  : d.passedSoft   ? "#f59e0b"
                  : "#ef4444";
                ctxH.beginPath();
                ctxH.arc(lm.x * c.width, lm.y * c.height, 5, 0, 2 * Math.PI);
                ctxH.fillStyle = dotColor;
                ctxH.fill();
              });
            } else if (!norm && matcherRef.current) {
              scoreRingRef.current = []; tierRingRef.current = [];
              smoothedScoreRef.current = 0; smoothedTierRef.current = "none";
              setDisplayScore(0); setMatchTier("none");
              setStatus(matcherRef.current.processFrame(null).status);
            }
          }
        } else if (!runPose && matcherRef.current) {
          scoreRingRef.current = []; tierRingRef.current = [];
          smoothedScoreRef.current = 0; smoothedTierRef.current = "none";
          setDisplayScore(0); setMatchTier("none");
          setStatus(matcherRef.current.processFrame(null).status);
        }
        processStretch();
      });
      await hands.initialize();
    }

    stopRef.current = false;

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
          await Promise.all([
            pose  ? pose.send({ image: videoRef.current })  : Promise.resolve(),
            hands ? hands.send({ image: videoRef.current }) : Promise.resolve(),
          ]);

          frameCounterRef.current++;
          if (emotionModelLoaded.current && frameCounterRef.current % 10 === 0 && isActiveRef.current) {
            try {
              const det = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceExpressions();
              if (det?.expressions) {
                const dom = Object.entries(det.expressions as any)
                  .sort((a: any, b: any) => b[1] - a[1])[0][0];
                setStrainEmotion(dom);
                emotionCountsRef.current[dom] = (emotionCountsRef.current[dom] ?? 0) + 1;
                const { angry, sad, fearful } = det.expressions as any;
                if ((angry ?? 0) + (sad ?? 0) + (fearful ?? 0) > 0.8) {
                  painReportedRef.current = true;
                  setPainDetected(true);
                  if (smoothedScoreRef.current < 50) triggerAudioWarning();
                }
              }
            } catch { /* non-critical */ }
          }
        }
        animRef.current = requestAnimationFrame(sendLoop);
      };
      animRef.current = requestAnimationFrame(sendLoop);
    } catch (e: any) { alert("Camera error: " + e.message); }
  }, [triggerAudioWarning, playBeep, handleMatchResult]);

  // ── Start ─────────────────────────────────────────────────────────────────
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

      // Reset all tracking
      scoreSumRef.current = 0; scoreCountRef.current = 0;
      correctPostureSecsRef.current = 0; totalSessionSecsRef.current = 0;
      scoreRingRef.current = []; tierRingRef.current = [];
      smoothedScoreRef.current = 0; smoothedTierRef.current = "none";
      emotionCountsRef.current = {};
      setCorrectPostureSecs(0); setTotalSessionSecs(0);
      setDisplayScore(0); setMatchTier("none");
      matcherRef.current?.reset();
      customCounterRef.current?.reset();
      prevRepCountRef.current = 0;
      setRepCount(0);
      setRepMatchScore(0);
      setRepFeedback("Ready");
      setPainDetected(false); painReportedRef.current = false;
      setBestStretchDist(null); setStretchDist(0);
      setStrainEmotion(null); setAlignmentCue(null);
      setStatus("Perform the exercise");

      startSessionTimer();
      initPose();
    } catch (e: any) { alert(`Could not start session: ${e.message}`); }
  };

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopLive = async () => {
    if (!sessionId) return;
    const token = localStorage.getItem("token");
    stopRef.current = true;
    stopSessionTimer();
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false); setStrainEmotion(null); setAlignmentCue(null);
    window.speechSynthesis.cancel(); setStatus("Session stopped");

    const finalCorrect    = correctPostureSecsRef.current;
    const finalTotal      = totalSessionSecsRef.current;
    const postureAccuracy = finalTotal > 0
      ? Math.round((finalCorrect / finalTotal) * 100) : 0;
    const avgDisplayScore = scoreCountRef.current > 0
      ? Math.round(scoreSumRef.current / scoreCountRef.current) : 0;

    const emotionEntries  = Object.entries(emotionCountsRef.current);
    const dominantEmotion = emotionEntries.length > 0
      ? emotionEntries.sort((a, b) => b[1] - a[1])[0][0] : null;

    try {
      await fetch("http://localhost:5000/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          formScore: avgDisplayScore,
          correctPostureSeconds: finalCorrect,
          allocatedDuration: finalTotal,
          postureAccuracy,
          bestStretchDist: bestStretchDist ?? undefined,
          dominantEmotion,
          emotionCounts: Object.fromEntries(emotionEntries),
          painDetected: painReportedRef.current,
        }),
      });
    } catch (e) { console.error("Failed to complete session", e); }

    setLastSessionSummary({
      exerciseName: template?.name ?? "Exercise",
      exerciseMode: template?.exerciseMode ?? "workout",
      correctPostureSeconds: finalCorrect,
      allocatedDuration: finalTotal,
      postureAccuracy,
      avgDisplayScore,
      formScore: avgDisplayScore,
      bestStretchDist: template?.exerciseMode === "stretch" ? (bestStretchDist ?? undefined) : undefined,
      helpThreshold: matcherRef.current?.currentSoftThreshold,
      painDetected: painReportedRef.current,
      dominantEmotion,
    });
    setChatbotOpen(true);
  };

  const handleChatbotClose = () => { setChatbotOpen(false); navigate("/patient"); };

  // ── Derived display ───────────────────────────────────────────────────────
  const liveAccuracy = totalSessionSecs > 0
    ? Math.round((correctPostureSecs / totalSessionSecs) * 100) : 0;
  const isStrainEmotion = strainEmotion ? STRAIN_EMOTIONS.includes(strainEmotion) : false;

  const tierBadge = {
    strong: { style: "bg-teal-500/20 border-teal-400/50 text-teal-300",   label: "Matching Template",             icon: <CheckCircle2 size={22} fill="currentColor" /> },
    soft:   { style: "bg-yellow-500/20 border-yellow-400/50 text-yellow-300", label: "Close — keep going!",        icon: <CheckCircle2 size={22} fill="currentColor" /> },
    none:   { style: "bg-slate-800/60 border-slate-600/50 text-slate-400", label: alignmentCue ?? "Adjust to match template", icon: <AlertCircle size={22} fill="currentColor" /> },
  }[matchTier];

  const cueCard = {
    strong: { style: "bg-teal-500/10 border-teal-500/30",   icon: <CheckCircle2 size={20} className="text-teal-400 shrink-0" />,   text: "text-teal-300",   label: "Matching physiotherapist template" },
    soft:   { style: "bg-yellow-500/10 border-yellow-500/30", icon: <CheckCircle2 size={20} className="text-yellow-400 shrink-0" />, text: "text-yellow-300", label: "Close match — minor misalignment tolerated" },
    none:   { style: "bg-slate-800 border-slate-700",        icon: <AlertCircle size={20} className="text-slate-500 shrink-0" />,   text: "text-slate-400",  label: alignmentCue ?? "Adjust pose to match template" },
  }[matchTier];

  const tierColour = { strong: "text-emerald-400", soft: "text-yellow-400", none: "text-slate-400" }[matchTier];

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loadingData) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
      <p className="text-red-400 text-lg font-medium">{error}</p>
      <button onClick={() => navigate("/patient")} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold transition">
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <>
      <div className="h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">

        {/* ── CAMERA ──────────────────────────────────────────────────────── */}
        <div className="flex-1 relative bg-black overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-transparent z-10 pointer-events-none" />
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />

          <button onClick={() => navigate("/patient")}
            className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition">
            <ChevronLeft size={16} /> Dashboard
          </button>

          {isActive && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
              <div className={`flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-all duration-300 ${tierBadge.style}`}>
                {tierBadge.icon}
                <span className="font-bold tracking-wide">{tierBadge.label}</span>
              </div>
            </div>
          )}

          {isActive && (strainEmotion || painDetected) && (
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
              {strainEmotion && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold backdrop-blur-sm border transition-all ${isStrainEmotion ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-slate-800/80 border-slate-700 text-slate-300"}`}>
                  <span className="text-lg leading-none">{EMOTION_EMOJI[strainEmotion] ?? "😐"}</span>
                  <span className="capitalize">{strainEmotion}</span>
                  {isStrainEmotion && <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold ml-1">Strain</span>}
                </div>
              )}
              {painDetected && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/30 border border-red-500/50 text-red-200 text-[10px] font-bold uppercase">
                  <AlertCircle size={12} /> Strain Logged
                </div>
              )}
            </div>
          )}

          {isActive && (
            <div className="absolute inset-0 z-20 flex items-end justify-center pb-8 pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl px-6 py-3 flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-black ${tierColour}`}>{displayScore}%</div>
                  <p className="text-slate-400 text-xs mt-0.5">Weighted Match</p>
                </div>
                <div className="border-l border-slate-600 pl-4 text-center">
                  <div className="text-white font-black text-3xl leading-none">{repCount}</div>
                  <p className="text-slate-400 text-xs mt-1">Reps</p>
                  <p className="text-[10px] mt-1 text-slate-500">{repMatchScore}% rep match</p>
                </div>
                <div className="border-l border-slate-600 pl-4">
                  <p className="text-white font-semibold text-sm leading-tight">{status}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    <span className={matchTier !== "none" ? "text-teal-400" : "text-slate-500"}>
                      {correctPostureSecs}s matched
                    </span>{" "}/ {totalSessionSecs}s total
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SIDE PANEL ──────────────────────────────────────────────────── */}
        <div className="w-full md:w-[400px] bg-slate-800 border-l border-slate-700 flex flex-col overflow-y-auto">

          {template?.videoUrl ? (
            <div className="p-4 border-b border-slate-700 bg-slate-900/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Reference Performance</p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded-full text-[9px] font-black uppercase">
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" /> Looping Demo
                </div>
              </div>
              <video ref={refVideoRef}
                src={template.videoUrl.startsWith("http") ? template.videoUrl : `http://localhost:5000${template.videoUrl}`}
                className="w-full aspect-video rounded-xl bg-black shadow-2xl border border-slate-700"
                muted playsInline autoPlay loop />
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
            <div className="p-8 text-center border-b border-slate-700">
              <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-50">
                <Activity size={24} className="text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm font-medium">No reference video available.</p>
            </div>
          )}

          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={18} className="text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Custom Exercise</span>
            </div>
            <h1 className="text-xl font-extrabold text-white leading-tight">{template?.name ?? "Exercise"}</h1>
            {template?.description && <p className="text-slate-400 text-sm mt-1">{template.description}</p>}
          </div>

          <div className="mx-4 mt-4 bg-slate-700/30 rounded-2xl p-4 space-y-4">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Clock size={16} /><span>Session Time</span></div>
              <span className="text-white font-black text-xl font-mono">{fmt(totalSessionSecs)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <CheckCircle2 size={16} className="text-teal-400" /><span>Template Matched</span>
              </div>
              <span className="text-teal-400 font-black text-xl font-mono">{fmt(correctPostureSecs)}</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-xs">Match Accuracy</span>
                <span className={`font-black text-sm ${liveAccuracy >= 75 ? "text-emerald-400" : liveAccuracy >= 50 ? "text-yellow-400" : "text-slate-400"}`}>
                  {liveAccuracy}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-1000 ${liveAccuracy >= 75 ? "bg-gradient-to-r from-teal-500 to-emerald-400" : liveAccuracy >= 50 ? "bg-gradient-to-r from-yellow-500 to-amber-400" : "bg-gradient-to-r from-slate-500 to-slate-400"}`}
                  style={{ width: `${Math.min(100, liveAccuracy)}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Strong ≥{Math.round(WEIGHTED_PASS_STRONG * 100)}% wt.joints
                </span>
                <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                  Close ≥{Math.round(WEIGHTED_PASS_SOFT * 100)}% wt.joints
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Zap size={16} /><span>Live Match Score</span></div>
              <span className={`font-black text-xl ${tierColour}`}>{displayScore}%</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Activity size={16} /><span>Reps</span></div>
              <span className="text-white font-black text-xl font-mono">{repCount}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-200 ${
                  repMatchScore >= 75 ? "bg-emerald-400" : repMatchScore >= 55 ? "bg-yellow-400" : "bg-rose-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, repMatchScore))}%` }}
              />
            </div>
            <p className="text-slate-400 text-xs">{repFeedback}</p>

            {template?.exerciseMode === "stretch" && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400 text-sm"><Expand size={16} /><span>Best Stretch</span></div>
                  <span className={`font-black text-xl ${bestStretchDist !== null ? "text-violet-400" : "text-slate-500"}`}>
                    {bestStretchDist !== null ? bestStretchDist.toFixed(2) : "--"}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-violet-500 to-fuchsia-400"
                    style={{ width: `${Math.min(100, Math.max(0, stretchDist * 200))}%` }} />
                </div>
              </>
            )}
          </div>

          {isActive && (
            <div className={`mx-4 mt-3 rounded-xl px-4 py-3 flex items-center gap-3 border transition-all ${cueCard.style}`}>
              {cueCard.icon}
              <div>
                <p className="text-xs uppercase tracking-wide font-bold mb-0.5 text-slate-400">Pose Match</p>
                <p className={`text-sm font-semibold ${cueCard.text}`}>{cueCard.label}</p>
              </div>
            </div>
          )}

          {isActive && strainEmotion && (
            <div className={`mx-4 mt-3 rounded-xl px-4 py-3 flex items-center justify-between border transition-all ${isStrainEmotion ? "bg-red-500/10 border-red-500/30" : "bg-slate-800 border-slate-700"}`}>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Expression</p>
                <p className={`font-semibold capitalize text-sm ${isStrainEmotion ? "text-red-300" : "text-emerald-300"}`}>{strainEmotion}</p>
                {isStrainEmotion && <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-0.5">Strain detected</p>}
              </div>
              <span className="text-3xl">{EMOTION_EMOJI[strainEmotion] ?? "😐"}</span>
            </div>
          )}

          {isActive && (
            <div className={`mx-4 mt-3 rounded-xl px-4 py-3 text-sm font-medium text-center transition-all ${status.includes("✓") ? "bg-emerald-500/20 text-emerald-300" : matchTier !== "none" ? "bg-teal-500/10 text-teal-300" : "bg-slate-800 text-slate-400"}`}>
              {status}
            </div>
          )}

          <div className="flex-1" />

          <div className="p-4 space-y-3">
            {!isActive ? (
              <button onClick={startLive}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-xl shadow-teal-500/20 active:scale-95">
                <Play size={20} fill="white" /> Start Session
              </button>
            ) : (
              <button onClick={stopLive}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-xl shadow-red-500/20 active:scale-95">
                <StopCircle size={20} /> End Session
              </button>
            )}
            <p className="text-center text-[11px] text-slate-600">
              Strong ≤{LANDMARK_DISTANCE_STRONG} · Soft ≤{LANDMARK_DISTANCE_SOFT} · Shoulders/Hips 3× · {SMOOTHING_WINDOW}-frame window
            </p>
          </div>
        </div>
      </div>

      {lastSessionSummary && (
        <PostSessionChatbot isOpen={chatbotOpen} onClose={handleChatbotClose} sessionSummary={lastSessionSummary} />
      )}
    </>
  );
};

export default PatientCustomExercise;