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

// --- Local MongoDB ---
const localConn = mongoose.createConnection(process.env.MONGODB_URI);
localConn.on('connected', () => console.log('✅ Local MongoDB connected'));
localConn.on('error',     err => console.error('Local MongoDB error:', err));

// --- Atlas MongoDB (fallback) ---
const atlasConn = mongoose.createConnection(process.env.ATLAS_URI);
atlasConn.on('connected', () => console.log('✅ Atlas MongoDB connected'));
atlasConn.on('error',     err => console.error('Atlas MongoDB error:', err));

// ─────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────
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

const localExerciseSchema = new mongoose.Schema({
  name:         String,
  injury_type:  [String],
  muscle_group: String,
  phase:        Number,
  description:  String,
  reps:         Number,
  sets:         Number,
  duration:     Number,
  frequency:    String,
  notes:        String
});

const atlasExerciseSchema = new mongoose.Schema({
  name:        String,
  reps:        Number,
  duration:    Number,
  description: String
}, { strict: false });

// NEW: Exercise log schema
const exerciseLogSchema = new mongoose.Schema({
  user_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  exercise_name:        String,
  muscle_group:         String,
  phase:                Number,
  prescribed_reps:      Number,
  prescribed_sets:      Number,
  prescribed_duration:  Number,
  prescribed_frequency: String,
  actual_reps:          Number,
  actual_sets:          Number,
  actual_duration:      Number,
  compliance_pct:       Number,
  pain_during:          Number,
  notes:                String,
  logged_at:            { type: Date, default: Date.now }
});

// ─────────────────────────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────────────────────────
const User          = localConn.model('User',          userSchema);
const Session       = localConn.model('Session',       sessionSchema);
const LocalExercise = localConn.model('LocalExercise', localExerciseSchema, 'local_exercises');
const AtlasExercise = atlasConn.model('Exercise',      atlasExerciseSchema, 'exercises');
const ExerciseLog   = localConn.model('ExerciseLog',   exerciseLogSchema,   'exercise_logs');

// ─────────────────────────────────────────────────────────────────
// RAG: Local-first, Atlas fallback
// ─────────────────────────────────────────────────────────────────
async function fetchRelevantExercises(injuryType, phase = null) {
  const results = { source: 'local', exercises: [] };

  try {
    const keywords = (injuryType || '')
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .filter(w => w.length > 2);

    const localKeywordQuery = keywords.length > 0 ? {
      $or: [
        { injury_type: { $elemMatch: { $in: keywords.map(kw => new RegExp(kw, 'i')) } } },
        ...keywords.map(kw => ({
          $or: [
            { name:         { $regex: kw, $options: 'i' } },
            { description:  { $regex: kw, $options: 'i' } },
            { muscle_group: { $regex: kw, $options: 'i' } }
          ]
        }))
      ]
    } : {};

    const phaseFilter = (phase && [1, 2, 3].includes(Number(phase)))
      ? { phase: Number(phase) } : {};

    const combinedQuery = {
      ...phaseFilter,
      ...(Object.keys(localKeywordQuery).length > 0 ? localKeywordQuery : {})
    };

    let localExercises = await LocalExercise.find(combinedQuery).limit(8);

    if (localExercises.length === 0 && phase) {
      localExercises = await LocalExercise.find(localKeywordQuery).limit(8);
    }

    if (localExercises.length === 0) {
      const fallbackQuery = phase ? { phase: Number(phase) } : {};
      localExercises = await LocalExercise.find(fallbackQuery).limit(6);
    }

    if (localExercises.length > 0) {
      results.source    = 'local';
      results.exercises = localExercises;
      console.log(`✅ RAG: ${localExercises.length} exercises from local DB (injury: "${injuryType}", phase: ${phase})`);
      return results;
    }
  } catch (err) {
    console.error('Local exercise fetch error:', err.message);
  }

  // Atlas fallback
  try {
    console.log('🔄 Falling back to Atlas...');
    const keywords = (injuryType || '').toLowerCase().replace(/[^a-z\s]/g, '').split(' ').filter(w => w.length > 3);
    let atlasExercises = [];
    if (keywords.length > 0) {
      const orConditions = keywords.flatMap(kw => [
        { description: { $regex: kw, $options: 'i' } },
        { name:        { $regex: kw, $options: 'i' } }
      ]);
      atlasExercises = await AtlasExercise.find({ $or: orConditions }).limit(8);
    }
    if (atlasExercises.length === 0) atlasExercises = await AtlasExercise.find().limit(6);
    results.source    = 'atlas';
    results.exercises = atlasExercises;
  } catch (err) {
    console.error('Atlas exercise fetch error:', err.message);
  }

  return results;
}

function formatExercises(ragResult) {
  const { exercises, source } = ragResult;
  if (!exercises || exercises.length === 0) return 'No specific exercises found in the PhysioCheck database.';
  const sourceLabel = source === 'local' ? '📋 PhysioCheck Exercise Database' : '📋 Sentinel Exercise Database (fallback)';
  const list = exercises.map(e => {
    const parts = [`• **${e.name}**`];
    if (e.muscle_group) parts.push(`_(${e.muscle_group})_`);
    parts.push(`— ${e.description || 'No description.'}`);
    if (e.reps)      parts.push(`| Reps: ${e.reps}`);
    if (e.sets)      parts.push(`| Sets: ${e.sets}`);
    if (e.duration)  parts.push(`| Duration: ${e.duration}s`);
    if (e.frequency) parts.push(`| Frequency: ${e.frequency}`);
    if (e.notes)     parts.push(`\n  ⚠️  Note: ${e.notes}`);
    return parts.join(' ');
  }).join('\n\n');
  return `${sourceLabel}:\n\n${list}`;
}

// ─────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────

// Intake
app.post('/intake', async (req, res) => {
  try {
    const { name, age, gender, injury_type, injury_date, pain_score, weight_bearing, swelling, pop_sound, numbness, deformity } = req.body;
    const redFlags = [];
    if (weight_bearing === 'No')     redFlags.push('Cannot bear weight');
    if (pop_sound      === 'Yes')    redFlags.push('Pop/snap sound heard');
    if (numbness       === 'Yes')    redFlags.push('Numbness or tingling present');
    if (deformity      === 'Yes')    redFlags.push('Visible deformity present');
    if (swelling       === 'Severe') redFlags.push('Severe swelling');
    const user = await User.create({ name, age, gender, injury_type, injury_date, symptoms: { weight_bearing, swelling, pop_sound, numbness, deformity } });
    await Session.create({ user_id: user._id, pain_score: Number(pain_score), swelling, message: 'Intake completed', bot_reply: 'Profile created successfully' });
    res.json({ success: true, userId: user._id, redFlags });
  } catch (error) {
    console.error('Intake error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (!user) return res.json({ found: false });
    res.json({ found: true, userId: user._id, name: user.name, phase: user.current_phase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check-in
app.post('/checkin', async (req, res) => {
  try {
    const { userId, pain_score, swelling, mobility, sleep_quality, mood } = req.body;
    await Session.create({ user_id: userId, pain_score: Number(pain_score), swelling, mobility, sleep_quality, mood, message: 'Daily check-in', bot_reply: `Check-in logged` });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// NEW: POST /exercise-log
// Called by CV module after exercise is completed
// Body: { userId, exerciseName, actualReps, actualSets, actualDuration, painDuring, notes }
// ─────────────────────────────────────────────────────────────────
app.post('/exercise-log', async (req, res) => {
  try {
    const { userId, exerciseName, actualReps, actualSets, actualDuration, painDuring, notes } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Find prescribed exercise from local DB
    const prescribed = await LocalExercise.findOne({
      name: { $regex: new RegExp(exerciseName, 'i') }
    });

    // Calculate compliance %
    let compliance = 100;
    if (prescribed) {
      const repScore = prescribed.reps  ? Math.min((Number(actualReps)  / prescribed.reps)  * 100, 100) : 100;
      const setScore = prescribed.sets  ? Math.min((Number(actualSets)  / prescribed.sets)  * 100, 100) : 100;
      compliance = Math.round((repScore + setScore) / 2);
    }

    const log = await ExerciseLog.create({
      user_id:              userId,
      exercise_name:        exerciseName,
      muscle_group:         prescribed?.muscle_group  || 'Unknown',
      phase:                user.current_phase,
      prescribed_reps:      prescribed?.reps          || null,
      prescribed_sets:      prescribed?.sets          || null,
      prescribed_duration:  prescribed?.duration      || null,
      prescribed_frequency: prescribed?.frequency     || null,
      actual_reps:          Number(actualReps)        || 0,
      actual_sets:          Number(actualSets)        || 0,
      actual_duration:      Number(actualDuration)    || 0,
      compliance_pct:       compliance,
      pain_during:          Number(painDuring)        || null,
      notes:                notes || ''
    });

    console.log(`📝 Exercise logged: ${exerciseName} | Compliance: ${compliance}% | User: ${user.name}`);
    res.json({ success: true, logId: log._id, compliance_pct: compliance });

  } catch (error) {
    console.error('Exercise log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// NEW: GET /exercise-report/:userId
// Generates full AI progress report from all exercise logs
// ─────────────────────────────────────────────────────────────────
app.get('/exercise-report/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const logs = await ExerciseLog.find({ user_id: userId }).sort({ logged_at: -1 });

    if (logs.length === 0) {
      return res.json({
        report: '## No Exercise Data Yet\n\nNo exercises have been logged yet. Complete your first exercise session to generate a progress report.',
        logs: [],
        summary: null
      });
    }

    // Build structured log text for Gemini
    const logText = logs.map((l, i) => {
      const date    = l.logged_at.toISOString().split('T')[0];
      const repLine = l.prescribed_reps  ? `Reps: ${l.actual_reps}/${l.prescribed_reps} prescribed`   : `Reps completed: ${l.actual_reps}`;
      const setLine = l.prescribed_sets  ? `Sets: ${l.actual_sets}/${l.prescribed_sets} prescribed`   : `Sets completed: ${l.actual_sets}`;
      const durLine = l.prescribed_duration ? `Duration: ${l.actual_duration}s/${l.prescribed_duration}s prescribed` : (l.actual_duration ? `Duration: ${l.actual_duration}s` : '');
      const painLine = l.pain_during ? `Pain during: ${l.pain_during}/10` : '';
      return `${i + 1}. [${date}] ${l.exercise_name} (Phase ${l.phase}, ${l.muscle_group})
   ${repLine} | ${setLine}${durLine ? ' | ' + durLine : ''}
   Compliance: ${l.compliance_pct}%${painLine ? ' | ' + painLine : ''}${l.notes ? '\n   Notes: ' + l.notes : ''}`;
    }).join('\n\n');

    // Aggregate stats
    const avgCompliance  = Math.round(logs.reduce((s, l) => s + (l.compliance_pct || 0), 0) / logs.length);
    const painLogs       = logs.filter(l => l.pain_during);
    const avgPain        = painLogs.length > 0
      ? (painLogs.reduce((s, l) => s + l.pain_during, 0) / painLogs.length).toFixed(1)
      : 'N/A';
    const recentLogs     = logs.slice(0, Math.min(3, logs.length));
    const earlierLogs    = logs.slice(-Math.min(3, logs.length));
    const recentAvg      = Math.round(recentLogs.reduce((s, l)  => s + l.compliance_pct, 0) / recentLogs.length);
    const earlierAvg     = Math.round(earlierLogs.reduce((s, l) => s + l.compliance_pct, 0) / earlierLogs.length);
    const trend          = recentAvg >= earlierAvg ? 'improving' : 'declining';

    // Recent checkins for context
    const recentCheckins = await Session.find({ user_id: userId, message: 'Daily check-in' })
      .sort({ created_at: -1 }).limit(5);
    const checkinText = recentCheckins.map(c =>
      `${c.created_at.toISOString().split('T')[0]}: Pain ${c.pain_score}/10, Swelling ${c.swelling}, Mobility ${c.mobility}`
    ).join('\n');

    const prompt = `
You are the PhysioCheck AI generating a detailed post-exercise progress report.

Patient: ${user.name}, Age: ${user.age}, Gender: ${user.gender}
Injury: ${user.injury_type}, Current Phase: ${user.current_phase}

EXERCISE LOG (most recent first):
${logText}

AGGREGATE STATS:
- Total sessions logged: ${logs.length}
- Average compliance: ${avgCompliance}%
- Average pain during exercise: ${avgPain}/10
- Compliance trend: ${trend} (recent avg: ${recentAvg}% vs earlier avg: ${earlierAvg}%)

RECENT DAILY CHECK-INS:
${checkinText || 'No check-ins available'}

Generate a structured progress report using markdown with these exact sections:

## 📊 Exercise Compliance Report — ${user.name}

### 1. Overall Performance Summary
(Compliance score, sessions completed, general trend — be specific with numbers)

### 2. Exercise-by-Exercise Breakdown
(For each exercise: prescribed vs actual, compliance %, and what it means clinically)

### 3. Pain Response During Exercise
(How pain during exercise compares to rest pain, what it suggests about healing)

### 4. Compliance Trend Analysis
(Is the patient improving, maintaining, or declining in adherence over time?)

### 5. What's Working Well
(Positive observations, exercises with high compliance — be specific)

### 6. Areas Needing Attention
(Low compliance exercises, possible reasons, and how to address them)

### 7. Phase Progression Assessment
(Based on compliance and pain data, is the patient ready to advance to the next phase?)

### 8. Recommendations for Next Session
(Specific adjustments to reps/sets/frequency/exercise selection based on the data)

### 9. Motivational Note
(Warm, encouraging personalized closing message for ${user.name})

Be specific, data-driven, and clinically sound. Always reference actual numbers from the logs.
    `;

    const response = await ai.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: prompt
    });

    // Per-exercise breakdown for frontend
    const exerciseBreakdown = logs.reduce((acc, l) => {
      if (!acc[l.exercise_name]) {
        acc[l.exercise_name] = { sessions: 0, totalCompliance: 0, avgCompliance: 0 };
      }
      acc[l.exercise_name].sessions++;
      acc[l.exercise_name].totalCompliance += l.compliance_pct;
      acc[l.exercise_name].avgCompliance = Math.round(
        acc[l.exercise_name].totalCompliance / acc[l.exercise_name].sessions
      );
      return acc;
    }, {});

    res.json({
      report: response.text,
      logs,
      summary: { totalSessions: logs.length, avgCompliance, avgPain, trend, recentAvg, earlierAvg, exerciseBreakdown }
    });

  } catch (error) {
    console.error('Exercise report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
app.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sessions = await Session.find({ user_id: userId }).sort({ created_at: 1 });
    const checkins = sessions.filter(s => s.pain_score != null && s.message !== 'Intake completed');
    const painLogs = checkins.map(s => ({
      date: s.created_at.toISOString().split('T')[0],
      pain_score: s.pain_score,
      swelling: s.swelling || '-', mobility: s.mobility || '-',
      sleep_quality: s.sleep_quality || '-', mood: s.mood || '-'
    }));
    const convoSessions = sessions.filter(s => s.message !== 'Intake completed' && s.message !== 'Daily check-in').slice(-10);
    const historyText   = convoSessions.map(s => `Patient: ${s.message}\nAssistant: ${s.bot_reply}`).join('\n');
    const trendText     = painLogs.map(p => `${p.date} — Pain: ${p.pain_score}/10, Swelling: ${p.swelling}, Mobility: ${p.mobility}, Sleep: ${p.sleep_quality}, Mood: ${p.mood}`).join('\n');
    const symptomText   = user.symptoms ? `Initial Symptoms: Weight bearing: ${user.symptoms.weight_bearing}, Swelling: ${user.symptoms.swelling}, Pop sound: ${user.symptoms.pop_sound}, Numbness: ${user.symptoms.numbness}, Deformity: ${user.symptoms.deformity}` : 'No symptom data';
    const ragResult     = await fetchRelevantExercises(user.injury_type || '', user.current_phase);
    const exerciseText  = formatExercises(ragResult);

    const prompt = `
      You are the PhysioCheck AI generating a structured recovery progress report.
      Patient: ${user.name}, Age: ${user.age}, Gender: ${user.gender}
      Injury: ${user.injury_type}, Injury Date: ${user.injury_date}, Current Phase: ${user.current_phase}
      ${symptomText}
      Daily tracking history: ${trendText || 'No check-ins yet'}
      Recent conversation history: ${historyText || 'No conversations yet'}
      Relevant exercises for Phase ${user.current_phase}: ${exerciseText}
      Generate a structured report with: 1. Patient Overview 2. Initial Red Flag Assessment 3. Pain Trend Analysis 4. Swelling & Mobility Trend 5. Sleep & Mood Pattern 6. Key Concerns from Conversations 7. Recommended Exercises 8. Phase Progression Recommendation 9. Next Steps
    `;

    const response = await ai.models.generateContent({ model: "models/gemini-2.5-flash", contents: prompt });
    res.json({ summary: response.text, painLogs, totalSessions: convoSessions.length, currentPhase: user.current_phase, symptoms: user.symptoms, exercises: ragResult.exercises });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat
app.post('/chat', async (req, res) => {
  try {
    const { message, userId, checkinData } = req.body;
    const user    = await User.findById(userId);
    const history = await Session.find({ user_id: userId }).sort({ created_at: -1 }).limit(5);
    history.reverse();
    const historyText   = history.filter(h => h.message !== 'Intake completed' && h.message !== 'Daily check-in').map(h => `Patient: ${h.message}\nAssistant: ${h.bot_reply}`).join('\n');
    const profileText   = user ? `Patient: ${user.name}, Age: ${user.age}, Gender: ${user.gender}, Injury: ${user.injury_type}, Current Phase: ${user.current_phase}` : 'New patient.';
    const checkinText   = checkinData ? `Today's check-in — Pain: ${checkinData.pain_score}/10, Swelling: ${checkinData.swelling}, Mobility: ${checkinData.mobility}, Sleep: ${checkinData.sleep_quality}, Mood: ${checkinData.mood}` : '';
    const symptomContext = user?.symptoms ? `Initial red flag symptoms — Weight bearing: ${user.symptoms.weight_bearing}, Swelling: ${user.symptoms.swelling}, Pop sound: ${user.symptoms.pop_sound}, Numbness: ${user.symptoms.numbness}, Deformity: ${user.symptoms.deformity}` : '';
    const ragResult     = await fetchRelevantExercises(user?.injury_type || message, user?.current_phase);
    const exerciseText  = formatExercises(ragResult);

    const prompt = `
      You are the PhysioCheck AI Assistant — professional, empathetic, evidence-based.
      You do NOT diagnose. You flag red symptoms and refer to doctors when needed.
      Rehab phases: Phase 1 (Inflammation/Protection), Phase 2 (ROM/Flexibility), Phase 3 (Strengthening).
      ${profileText}
      ${symptomContext}
      ${checkinText}
      Recent conversation: ${historyText}
      Exercises from PhysioCheck database for ${user?.injury_type || 'unknown'} injury, Phase ${user?.current_phase || 1}:
      ${exerciseText}
      Patient message: ${message}
      Recommend exercises by name from the list above. Explain how each helps. Give step-by-step instructions.
    `;

    const response = await ai.models.generateContent({ model: "models/gemini-2.5-flash", contents: prompt });
    const botReply = response.text;

    await Session.create({
      user_id: userId,
      pain_score: checkinData?.pain_score ? Number(checkinData.pain_score) : null,
      swelling: checkinData?.swelling || null, mobility: checkinData?.mobility || null,
      sleep_quality: checkinData?.sleep_quality || null, mood: checkinData?.mood || null,
      message, bot_reply: botReply
    });

    res.json({ reply: botReply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 5000, () =>
  console.log('🚀 PhysioCheck Server running on http://localhost:5000')
);