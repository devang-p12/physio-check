import type {
  CustomExerciseOutput,
  MatchTier,
  RawLandmark,
  RepPhase,
  TemplateFrame,
  TwoKeyframeDescriptor,
  JointName,
  Vec3,
} from '../types';
import { LandmarkIndex } from '../types';
import { FULL_BODY_IDX, UPPER_BODY_IDX, normalizePoseToShoulders } from '../normalization/normalizePose';
import { analyzeTwoKeyframes } from '../analysis/twoKeyframeMovement';
import { MovingAverageFilter } from '../utils/smoothing';
import { angleBetweenVectors, signedProgressDeg, safeUnitVector } from '../math/angle';

const VIS_THRESHOLD = 0.4;

function getTemplateIdxList(templateFrames: TemplateFrame[]): readonly number[] {
  const len = templateFrames[0]?.length ?? 0;
  if (len === FULL_BODY_IDX.length) return FULL_BODY_IDX;
  return UPPER_BODY_IDX;
}

function toIndexedFrame(frame: TemplateFrame, idxList: readonly number[]): TemplateFrame {
  const indexed: TemplateFrame = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  idxList.forEach((mpIdx, i) => {
    const lm = frame[i];
    if (lm) indexed[mpIdx] = lm;
  });
  return indexed;
}

function jointIdxFromName(j: JointName): LandmarkIndex {
  switch (j) {
    case 'leftShoulder': return LandmarkIndex.LEFT_SHOULDER;
    case 'rightShoulder': return LandmarkIndex.RIGHT_SHOULDER;
    case 'leftElbow': return LandmarkIndex.LEFT_ELBOW;
    case 'rightElbow': return LandmarkIndex.RIGHT_ELBOW;
    case 'leftWrist': return LandmarkIndex.LEFT_WRIST;
    case 'rightWrist': return LandmarkIndex.RIGHT_WRIST;
    case 'leftHip': return LandmarkIndex.LEFT_HIP;
    case 'rightHip': return LandmarkIndex.RIGHT_HIP;
    case 'leftKnee': return LandmarkIndex.LEFT_KNEE;
    case 'rightKnee': return LandmarkIndex.RIGHT_KNEE;
    case 'leftAnkle': return LandmarkIndex.LEFT_ANKLE;
    case 'rightAnkle': return LandmarkIndex.RIGHT_ANKLE;
  }
}

function landmarkVisible(raw: RawLandmark[] | null, idx: number): boolean {
  const lm = raw?.[idx];
  return !!lm && (lm.visibility ?? 1) >= VIS_THRESHOLD;
}

function tierFromScore(score: number): MatchTier {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'soft';
  return 'none';
}

export class CustomExerciseCounter {
  private reps = 0;
  private phase: RepPhase = 'atStart';
  private descriptor: TwoKeyframeDescriptor | null = null;
  private idxList: readonly number[] = UPPER_BODY_IDX;
  private templateIsUpperBody = true;

  private startVec: Vec3 = { x: 0, y: 0, z: 0 };
  private endVec: Vec3 = { x: 0, y: 0, z: 0 };
  private rotationDeltaDeg = 0;
  private translationDelta = 0;

  private progressSmoother = new MovingAverageFilter(4);
  private scoreSmoother = new MovingAverageFilter(4);

  initFromTemplate(templateFrames: TemplateFrame[]): void {
    if (!templateFrames || templateFrames.length < 2) {
      this.descriptor = null;
      return;
    }
    this.idxList = getTemplateIdxList(templateFrames);
    this.templateIsUpperBody = this.idxList.length === UPPER_BODY_IDX.length;

    // Convert template normalized frames back into index-addressable [0..32] space.
    const start = toIndexedFrame(templateFrames[0], this.idxList);
    const end = toIndexedFrame(templateFrames[templateFrames.length - 1], this.idxList);

    this.descriptor = analyzeTwoKeyframes({ start, end, templateIsUpperBody: this.templateIsUpperBody });
    this.rotationDeltaDeg = this.descriptor.rotationDeltaDeg;
    this.translationDelta = this.descriptor.translationDelta;

    const movingIdx = jointIdxFromName(this.descriptor.movingJoint);
    const refIdx =
      this.descriptor.referenceJoint === 'origin'
        ? null
        : jointIdxFromName(this.descriptor.referenceJoint);

    const startMoving = start[movingIdx];
    const endMoving = end[movingIdx];
    const startRef = refIdx != null ? start[refIdx] : { x: 0, y: 0, z: 0, visibility: 1 };
    const endRef = refIdx != null ? end[refIdx] : { x: 0, y: 0, z: 0, visibility: 1 };

    this.startVec = safeUnitVector(startRef, startMoving);
    this.endVec = safeUnitVector(endRef, endMoving);

    this.resetRuntime();
  }

  updateFromLivePose(rawPoseLandmarks: RawLandmark[] | null): CustomExerciseOutput {
    if (!this.descriptor) return this.empty('No template movement descriptor');
    if (!rawPoseLandmarks) return this.empty('No pose detected');

    const normalized = normalizePoseToShoulders(rawPoseLandmarks, this.idxList);
    if (!normalized) return this.empty('Pose not visible');

    const indexed = toIndexedFrame(normalized, this.idxList);

    const movingIdx = jointIdxFromName(this.descriptor.movingJoint);
    const refIdx =
      this.descriptor.referenceJoint === 'origin'
        ? null
        : jointIdxFromName(this.descriptor.referenceJoint);

    const moving = indexed[movingIdx];
    const ref = refIdx != null ? indexed[refIdx] : { x: 0, y: 0, z: 0, visibility: 1 };

    const visibilityOk =
      (moving.visibility ?? 1) >= VIS_THRESHOLD &&
      (refIdx == null || (indexed[refIdx]?.visibility ?? 1) >= VIS_THRESHOLD);

    if (!visibilityOk) return this.empty('Key joints not visible');

    const currentVec = safeUnitVector(ref, moving);

    const rawProgress = signedProgressDeg({ currentVec, startVec: this.startVec, endVec: this.endVec });
    const progressDeg = this.progressSmoother.push(rawProgress);

    const total = Math.max(1e-6, angleBetweenVectors(this.startVec, this.endVec));
    const ratio = Math.min(1, Math.max(0, progressDeg / total));

    // Match score purely from progress closeness to either endpoint.
    const angleToStart = angleBetweenVectors(currentVec, this.startVec);
    const angleToEnd = angleBetweenVectors(currentVec, this.endVec);
    const closeness = 1 - Math.min(angleToStart, angleToEnd) / Math.max(1e-6, total);
    const score = this.scoreSmoother.push(Math.max(0, Math.min(100, closeness * 100)));
    const matchTier = tierFromScore(score);

    // Deterministic rep state machine: Start -> End -> Start counts 1 rep.
    const startEnter = Math.max(10, total * 0.25);
    const endEnter = Math.max(10, total * 0.25);
    const midLeave = Math.max(12, total * 0.35);

    const atStartNow = angleToStart <= startEnter;
    const atEndNow = angleToEnd <= endEnter;

    switch (this.phase) {
      case 'atStart':
        if (!atStartNow && ratio > 0.15) this.phase = 'movingToEnd';
        break;
      case 'movingToEnd':
        if (atEndNow) this.phase = 'atEnd';
        else if (atStartNow && ratio < 0.1) this.phase = 'atStart';
        break;
      case 'atEnd':
        if (!atEndNow && ratio < 0.85) this.phase = 'movingToStart';
        break;
      case 'movingToStart':
        if (atStartNow) {
          this.phase = 'atStart';
          this.reps += 1;
        } else if (atEndNow && ratio > 0.9) {
          this.phase = 'atEnd';
        } else if (ratio > 0.5 && angleToStart > midLeave && angleToEnd > midLeave) {
          // keep moving
        }
        break;
    }

    const feedback =
      this.phase === 'atStart' ? 'Start the movement'
        : this.phase === 'movingToEnd' ? 'Keep moving...'
        : this.phase === 'atEnd' ? 'Great — now return'
        : 'Return to start to count the rep';

    return {
      reps: this.reps,
      phase: this.phase,
      movingJoint: this.descriptor.movingJoint,
      referenceJoint: this.descriptor.referenceJoint,
      rotationProgressDeg: progressDeg,
      rotationDeltaDeg: this.rotationDeltaDeg,
      translationDelta: this.translationDelta,
      matchTier,
      matchScore: Math.round(score),
      feedback,
    };
  }

  reset(): void {
    this.reps = 0;
    this.resetRuntime();
  }

  getReps(): number {
    return this.reps;
  }

  private resetRuntime(): void {
    this.phase = 'atStart';
    this.progressSmoother.reset();
    this.scoreSmoother.reset();
  }

  private empty(reason: string): CustomExerciseOutput {
    const mj = this.descriptor?.movingJoint ?? null;
    const rj = this.descriptor?.referenceJoint ?? null;
    return {
      reps: this.reps,
      phase: this.phase,
      movingJoint: mj,
      referenceJoint: rj,
      rotationProgressDeg: 0,
      rotationDeltaDeg: this.rotationDeltaDeg,
      translationDelta: this.translationDelta,
      matchTier: 'none',
      matchScore: 0,
      feedback: reason,
    };
  }
}

