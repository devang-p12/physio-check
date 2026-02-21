import express from "express";
import { auth } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// Tracks last request time per user to enforce minimum gap between calls
const lastRequestPerUser = new Map();
const MIN_GAP_MS = 6000; // 6 seconds between requests = max 10/min (well under free tier limit of 15/min)

// ── Retry helper with exponential backoff ─────────────────────────────────────
async function fetchGeminiWithRetry(contents, apiKey, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = 5000 * attempt; // 5s, 10s
      console.log(`[Gemini] Retry attempt ${attempt} after ${waitMs}ms`);
      await new Promise(r => setTimeout(r, waitMs));
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
      }
    );

    if (response.status === 429) {
      console.warn(`[Gemini] 429 on attempt ${attempt + 1}`);
      if (attempt === maxRetries - 1) return null; // exhausted retries
      continue;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Gemini HTTP ${response.status}`);
    }

    return await response.json();
  }
  return null;
}

// ── POST /api/gemini/chat ─────────────────────────────────────────────────────
router.post("/chat", auth, async (req, res) => {
  const userId = req.user?.id ?? req.user?._id ?? "unknown";
  const { contents } = req.body;

  if (!contents || !Array.isArray(contents)) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  // Per-user rate limiting
  const now = Date.now();
  const lastRequest = lastRequestPerUser.get(userId) ?? 0;
  const elapsed = now - lastRequest;

  if (elapsed < MIN_GAP_MS) {
    const waitSecs = Math.ceil((MIN_GAP_MS - elapsed) / 1000);
    return res.status(429).json({
      message: `Please wait ${waitSecs} more second${waitSecs > 1 ? "s" : ""} before sending another message.`,
      retryAfter: waitSecs,
    });
  }

  lastRequestPerUser.set(userId, now);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "Gemini API key not configured on server" });
    }

    const data = await fetchGeminiWithRetry(contents, apiKey);

    if (!data) {
      return res.status(429).json({
        message: "Gemini is rate limited right now. Please wait 30 seconds and try again.",
        retryAfter: 30,
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't generate a response. Please try again.";
    res.json({ text });

  } catch (err) {
    console.error("[Gemini proxy error]", err.message);
    res.status(500).json({ message: "Server error calling Gemini" });
  }
});

export default router;