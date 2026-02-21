import {
  createTemplate,
  getTemplatesByDoctor,
  getTemplateById,
  deleteTemplate,
} from '../models/CustomExerciseTemplate.model.js';
import { createAssignment } from '../models/Assignment.model.js';
import { findUserById } from '../models/User.model.js';

// ─── Doctor: upload a new template ──────────────────────────────────────────
export const uploadTemplate = async (req, res) => {
  const doctorId = req.user.id;
  const {
    name, description, category,
    frameCount, durationSeconds, frames,
    exerciseMode, exerciseType, stretchConfig,
  } = req.body;

  if (!name || frameCount == null || durationSeconds == null) {
    return res.status(400).json({ message: 'name, frameCount and durationSeconds are required' });
  }

  // Stretch templates need stretchConfig; workout templates need frames
  if (exerciseMode === 'stretch' && (!stretchConfig?.lm1 == null || stretchConfig?.lm2 == null || !stretchConfig?.direction)) {
    return res.status(400).json({ message: 'stretchConfig (lm1, lm2, direction) required for stretch exercises' });
  }
  if (exerciseMode !== 'stretch' && !frames) {
    return res.status(400).json({ message: 'frames required for workout exercises' });
  }

  try {
    const template = await createTemplate({
      name,
      description: description || '',
      category: category || 'Custom',
      createdBy: doctorId,
      exerciseMode: exerciseMode || 'workout',
      exerciseType: exerciseType || 'body',
      frameCount,
      durationSeconds,
      frames: frames || [],
      stretchConfig: stretchConfig || undefined,
    });

    return res.status(201).json({
      message: 'Template saved to library',
      template: {
        id: template._id.toString(),
        name: template.name,
        description: template.description,
        category: template.category,
        exerciseMode: template.exerciseMode,
        exerciseType: template.exerciseType,
        frameCount: template.frameCount,
        durationSeconds: template.durationSeconds,
        stretchConfig: template.stretchConfig,
        createdAt: template.createdAt,
      },
    });
  } catch (err) {
    console.error('uploadTemplate error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Doctor: list their own templates (no frames) ───────────────────────────
export const listTemplates = async (req, res) => {
  const doctorId = req.user.id;
  try {
    const templates = await getTemplatesByDoctor(doctorId);
    return res.json({
      templates: templates.map(t => ({
        id: t._id.toString(),
        name: t.name,
        description: t.description,
        category: t.category,
        frameCount: t.frameCount,
        durationSeconds: t.durationSeconds,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    console.error('listTemplates error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Doctor: delete a template ───────────────────────────────────────────────
export const removeTemplate = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;
  try {
    const deleted = await deleteTemplate(id, doctorId);
    if (!deleted) return res.status(404).json({ message: 'Template not found or not owned by you' });
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('removeTemplate error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Doctor: assign a custom-template exercise to a patient ─────────────────
export const assignCustomExercise = async (req, res) => {
  const doctorId = req.user.id;
  const { patientId, customTemplateId, date, endDate, sets, repsPerSet, tolerances = [] } = req.body;

  if (!patientId || !customTemplateId || !date || !sets || !repsPerSet) {
    return res.status(400).json({ message: 'patientId, customTemplateId, date, sets and repsPerSet are required' });
  }

  if (!Number.isInteger(Number(sets)) || !Number.isInteger(Number(repsPerSet)) || sets <= 0 || repsPerSet <= 0) {
    return res.status(400).json({ message: 'sets and repsPerSet must be positive integers' });
  }

  try {
    const patient = await findUserById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const template = await getTemplateById(customTemplateId);
    if (!template) {
      return res.status(404).json({ message: 'Custom exercise template not found' });
    }

    const assignment = await createAssignment({
      doctorId,
      patientId,
      // exerciseId left undefined for custom exercises — model allows this
      customTemplateId,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : undefined,
      prescription: JSON.stringify({ sets: Number(sets), repsPerSet: Number(repsPerSet), tolerances }),
    });

    return res.status(201).json({
      message: 'Custom exercise assigned successfully',
      assignment: {
        id: assignment._id.toString(),
        doctorId: assignment.doctorId.toString(),
        patientId: assignment.patientId.toString(),
        customTemplateId: assignment.customTemplateId.toString(),
        date: assignment.date,
        prescription: assignment.prescription,
      },
    });
  } catch (err) {
    console.error('assignCustomExercise error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Patient: get full template (with frames) for playback ──────────────────
export const getTemplateForPatient = async (req, res) => {
  const { id } = req.params;
  try {
    const template = await getTemplateById(id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    return res.json({
      template: {
        id: template._id.toString(),
        name: template.name,
        description: template.description,
        category: template.category,
        frameCount: template.frameCount,
        durationSeconds: template.durationSeconds,
        frames: template.frames,
      },
    });
  } catch (err) {
    console.error('getTemplateForPatient error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
