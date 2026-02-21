const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1"
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// --- Schemas ---
const userSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  age:           Number,
  gender:        String,
  injury_type:   String,
  injury_date:   String,
  current_phase: { type: Number, default: 1 },
  symptoms: {
    weight_bearing: String,
    swelling:       String,
    pop_sound:      String,
    numbness:       String,
    deformity:      String
  },
  created_at: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  user_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pain_score:    Number,
  swelling:      String,
  mobility:      String,
  sleep_quality: String,
  mood:          String,
  message:       String,
  bot_reply:     String,
  created_at:    { type: Date, default: Date.now }
});

const User    = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);

// --- Intake Route ---
app.post('/intake', async (req, res) => {
  try {
    const {
      name, age, gender, injury_type, injury_date, pain_score,
      weight_bearing, swelling, pop_sound, numbness, deformity
    } = req.body;

    // Red flag check
    const redFlags = [];
    if (weight_bearing === 'No')          redFlags.push('Cannot bear weight');
    if (pop_sound      === 'Yes')         redFlags.push('Pop/snap sound heard');
    if (numbness       === 'Yes')         redFlags.push('Numbness or tingling present');
    if (deformity      === 'Yes')         redFlags.push('Visible deformity present');
    if (swelling       === 'Severe')      redFlags.push('Severe swelling');

    const user = await User.create({
      name, age, gender, injury_type, injury_date,
      symptoms: { weight_bearing, swelling, pop_sound, numbness, deformity }
    });

    await Session.create({
      user_id:    user._id,
      pain_score: Number(pain_score),
      swelling,
      message:    'Intake completed',
      bot_reply:  'Profile created successfully'
    });

    res.json({ success: true, userId: user._id, redFlags });
  } catch (error) {
    console.error('Intake error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Login Route ---
app.post('/login', async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    if (!user) return res.json({ found: false });
    res.json({ found: true, userId: user._id, name: user.name, phase: user.current_phase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Daily Check-in Route ---
app.post('/checkin', async (req, res) => {
  try {
    const { userId, pain_score, swelling, mobility, sleep_quality, mood } = req.body;

    await Session.create({
      user_id: userId,
      pain_score: Number(pain_score),
      swelling, mobility, sleep_quality, mood,
      message:   'Daily check-in',
      bot_reply: `Check-in logged: Pain ${pain_score}/10, Swelling: ${swelling}, Mobility: ${mobility}, Sleep: ${sleep_quality}, Mood: ${mood}`
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Summary Route ---
app.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sessions = await Session.find({ user_id: userId }).sort({ created_at: 1 });

    const checkins = sessions.filter(s =>
      s.pain_score != null && s.message !== 'Intake completed'
    );

    const painLogs = checkins.map(s => ({
      date:          s.created_at.toISOString().split('T')[0],
      pain_score:    s.pain_score,
      swelling:      s.swelling      || '-',
      mobility:      s.mobility      || '-',
      sleep_quality: s.sleep_quality || '-',
      mood:          s.mood          || '-'
    }));

    const convoSessions = sessions
      .filter(s => s.message !== 'Intake completed' && s.message !== 'Daily check-in')
      .slice(-10);

    const historyText = convoSessions
      .map(s => `Patient: ${s.message}\nAssistant: ${s.bot_reply}`)
      .join('\n');

    const trendText = painLogs.map(p =>
      `${p.date} — Pain: ${p.pain_score}/10, Swelling: ${p.swelling}, Mobility: ${p.mobility}, Sleep: ${p.sleep_quality}, Mood: ${p.mood}`
    ).join('\n');

    const symptomText = user.symptoms ? `
      Initial Symptoms:
      - Weight bearing: ${user.symptoms.weight_bearing}
      - Initial swelling: ${user.symptoms.swelling}
      - Pop/snap sound: ${user.symptoms.pop_sound}
      - Numbness/tingling: ${user.symptoms.numbness}
      - Deformity: ${user.symptoms.deformity}
    ` : 'No symptom data';

    const prompt = `
      You are the PhysioCheck AI generating a structured recovery progress report.

      Patient: ${user.name}, Age: ${user.age}, Gender: ${user.gender}
      Injury: ${user.injury_type}, Injury Date: ${user.injury_date}
      Current Phase: ${user.current_phase}

      ${symptomText}

      Daily tracking history (oldest to newest):
      ${trendText || 'No check-ins yet'}

      Recent conversation history:
      ${historyText || 'No conversations yet'}

      Generate a structured report with these sections:
      1. Patient Overview
      2. Initial Red Flag Assessment (based on intake symptoms)
      3. Pain Trend Analysis
      4. Swelling & Mobility Trend
      5. Sleep & Mood Pattern
      6. Key Concerns from Conversations
      7. Phase Progression Recommendation
      8. Next Steps

      Be professional, evidence-based, and encouraging. Flag anything clinically concerning clearly.
    `;

    const response = await ai.models.generateContent({
      model: "models/gemini-2.5-flash",
      contents: prompt
    });

    res.json({
      summary:       response.text,
      painLogs,
      totalSessions: convoSessions.length,
      currentPhase:  user.current_phase,
      symptoms:      user.symptoms
    });

  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Chat Route ---
app.post('/chat', async (req, res) => {
  try {
    const { message, userId, checkinData } = req.body;

    const user    = await User.findById(userId);
    const history = await Session.find({ user_id: userId })
      .sort({ created_at: -1 }).limit(5);
    history.reverse();

    const historyText = history
      .filter(h => h.message !== 'Intake completed' && h.message !== 'Daily check-in')
      .map(h => `Patient: ${h.message}\nAssistant: ${h.bot_reply}`)
      .join('\n');

    const profileText = user
      ? `Patient: ${user.name}, Age: ${user.age}, Gender: ${user.gender}, Injury: ${user.injury_type}, Phase: ${user.current_phase}`
      : 'New patient.';

    const checkinText = checkinData
      ? `Today's check-in — Pain: ${checkinData.pain_score}/10, Swelling: ${checkinData.swelling}, Mobility: ${checkinData.mobility}, Sleep: ${checkinData.sleep_quality}, Mood: ${checkinData.mood}`
      : '';

    const symptomContext = user.symptoms
      ? `Initial red flag symptoms — Weight bearing: ${user.symptoms.weight_bearing}, Swelling: ${user.symptoms.swelling}, Pop sound: ${user.symptoms.pop_sound}, Numbness: ${user.symptoms.numbness}, Deformity: ${user.symptoms.deformity}`
      : '';

    const prompt = `
      You are the PhysioCheck AI Assistant — professional, empathetic, evidence-based.
      You do NOT diagnose. You flag red symptoms and refer to doctors when needed.
      Rehab phases: Phase 1 (Inflammation), Phase 2 (ROM), Phase 3 (Strengthening).

      ${profileText}
      ${symptomContext}
      ${checkinText}

      Recent conversation:
      ${historyText}

      Patient: ${message}
    `;

    const response = await ai.models.generateContent({
      model: "models/gemini-2.5-flash",
      contents: prompt
    });

    const botReply = response.text;

    await Session.create({
      user_id:       userId,
      pain_score:    checkinData?.pain_score    ? Number(checkinData.pain_score) : null,
      swelling:      checkinData?.swelling      || null,
      mobility:      checkinData?.mobility      || null,
      sleep_quality: checkinData?.sleep_quality || null,
      mood:          checkinData?.mood          || null,
      message,
      bot_reply: botReply
    });

    res.json({ reply: botReply });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () =>
  console.log('🚀 PhysioCheck Server running on http://localhost:5000')
);