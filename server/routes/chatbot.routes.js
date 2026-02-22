import express from "express";
import { auth } from "../middleware/auth.middleware.js";
import Session from "../models/Session.model.js";

const router = express.Router();

// Helper to interact with Gemini API
async function fetchGeminiWithRetry(contents, apiKey, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
            const waitMs = 5000 * attempt;
            console.log(`[Gemini] Retry attempt ${attempt} after ${waitMs}ms`);
            await new Promise((r) => setTimeout(r, waitMs));
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
                }),
            }
        );

        if (response.status === 429) {
            console.warn(`[Gemini] 429 on attempt ${attempt + 1}`);
            if (attempt === maxRetries - 1) return null;
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

// ── GET /chatbot/greeting ─────────────────────────────────────────────────────
// Generates an initial motivational greeting based on past performance
router.get("/greeting", auth, async (req, res) => {
    const userId = req.user?.id ?? req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const sessions = await Session.find({ patientId: userId, status: "completed" })
            .sort({ startTime: -1 })
            .limit(5)
            .populate({
                path: "assignmentId",
                populate: [{ path: "exerciseId" }, { path: "customTemplateId" }]
            });

        let historyText = "No previous session data available.";
        if (sessions.length > 0) {
            historyText = "Recent Sessions:\n" + sessions.map((s, i) => {
                const title = s.assignmentId?.exerciseId?.name || s.assignmentId?.customTemplateId?.title || "Exercise Session";
                const formScore = s.analytics?.formQuality?.score || "N/A";
                const reps = s.analytics?.repsCompleted || "N/A";
                const date = new Date(s.endTime || s.startTime).toLocaleDateString();
                return `- ${date}: ${title}, Reps: ${reps}, Form Score: ${formScore}%`;
            }).join("\n");
        }

        const sysPrompt = `You are a highly motivating, energetic physiotherapy coach.
The user just opened the chat. Greet them warmly and specifically reference their recent performance to motivate them if data is available. 
For example, if they did well yesterday, say "You beat your yesterday's record!" or "Great form score yesterday!".
Keep the greeting relatively concise (under 50 words) and energetic.

Patient's recent history:
${historyText}`;

        const contents = [{ role: "user", parts: [{ text: sysPrompt }] }];

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ message: "Gemini API key not configured" });

        const data = await fetchGeminiWithRetry(contents, apiKey);
        if (!data) return res.status(429).json({ reply: "Welcome back! Ready for today's session?" });

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Welcome back! Let's get moving today!";
        res.json({ reply });

    } catch (err) {
        console.error("[Chatbot Greeting Error]", err);
        res.status(500).json({ reply: "Welcome back! How can I help you today?" });
    }
});

// ── POST /chatbot/message ─────────────────────────────────────────────────────
router.post("/message", auth, async (req, res) => {
    const userId = req.user?.id ?? req.user?._id;
    const { message, chatHistory = "[]" } = req.body;

    if (!message) return res.status(400).json({ message: "Message is required" });

    try {
        const sessions = await Session.find({ patientId: userId, status: "completed" })
            .sort({ startTime: -1 })
            .limit(5)
            .populate({
                path: "assignmentId",
                populate: [{ path: "exerciseId" }, { path: "customTemplateId" }]
            });

        let historyText = "No previous session data available.";
        if (sessions.length > 0) {
            historyText = "Past completed sessions (newest first):\n" + sessions.map((s) => {
                const title = s.assignmentId?.exerciseId?.name || s.assignmentId?.customTemplateId?.title || "Exercise Session";
                const formScore = s.analytics?.formQuality?.score || "N/A";
                const repsCompleted = s.analytics?.repsCompleted || "N/A";
                const date = new Date(s.endTime || s.startTime).toLocaleDateString();
                return `- Date: ${date} | Exercise: ${title} | Reps: ${repsCompleted} | Form Score: ${formScore}%`;
            }).join("\n");
        }

        const sysPrompt = `You are PhysioAI, a highly motivating and knowledgeable physiotherapy assistant.
Your main goal is to motivate the patient for continuity and recovery while providing safe advice.
Always encourage the patient by referencing their past progress when relevant. 

Patient's recent exercise history from the database:
${historyText}

Guidelines:
- **Current Session Context**: Pay close attention to the user's current state based on this chat history. If they mention feeling pain, discomfort, or excessive fatigue, immediately adjust your tone to be extremely cautious, empathetic, and prioritize their safety over motivation. Advise them to stop if necessary.
- If they ask about past sessions, answer accurately based on the history provided.
- Praise improvements in form score or reps.
- If no history exists, encourage them to complete their first session.
- Always be empathetic, positive, and supportive.
- Do not provide medical diagnoses; tell them to see their doctor for severe pain.
- Keep responses concise unless explicitly asked for detail (max 100 words).`;

        let parsedHistory = [];
        try {
            parsedHistory = JSON.parse(chatHistory);
        } catch { }

        const contents = [
            { role: "user", parts: [{ text: sysPrompt }] },
            { role: "model", parts: [{ text: "Understood. I will be encouraging and reference their past data." }] },
            ...parsedHistory.map((m) => ({
                role: m.role === "bot" ? "model" : "user",
                parts: [{ text: m.text }],
            })),
            { role: "user", parts: [{ text: message }] },
        ];

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ message: "Gemini API key not configured" });

        const data = await fetchGeminiWithRetry(contents, apiKey);
        if (!data) return res.status(429).json({ reply: "I'm a bit overwhelmed right now. Try again in a moment." });

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I'm having trouble thinking of a response.";
        res.json({ reply });

    } catch (err) {
        console.error("[Chatbot Message Error]", err);
        res.status(500).json({ reply: "Sorry, an internal error occurred." });
    }
});

export default router;
