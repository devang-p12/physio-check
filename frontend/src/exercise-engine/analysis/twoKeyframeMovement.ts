import type {
  JointName,
  JointTriplet,
  TemplateFrame,
  TwoKeyframeDescriptor,
  Vec3,
} from '../types';
import { LandmarkIndex } from '../types';
import { distance } from '../math/vector';
import { angleBetweenVectors, computeAngleDeltaFromTemplate, safeUnitVector } from '../math/angle';

const JOINTS: Array<{ name: JointName; idx: LandmarkIndex }> = [
  { name: 'leftShoulder', idx: LandmarkIndex.LEFT_SHOULDER },
  { name: 'rightShoulder', idx: LandmarkIndex.RIGHT_SHOULDER },
  { name: 'leftElbow', idx: LandmarkIndex.LEFT_ELBOW },
  { name: 'rightElbow', idx: LandmarkIndex.RIGHT_ELBOW },
  { name: 'leftWrist', idx: LandmarkIndex.LEFT_WRIST },
  { name: 'rightWrist', idx: LandmarkIndex.RIGHT_WRIST },
  { name: 'leftHip', idx: LandmarkIndex.LEFT_HIP },
  { name: 'rightHip', idx: LandmarkIndex.RIGHT_HIP },
  { name: 'leftKnee', idx: LandmarkIndex.LEFT_KNEE },
  { name: 'rightKnee', idx: LandmarkIndex.RIGHT_KNEE },
  { name: 'leftAnkle', idx: LandmarkIndex.LEFT_ANKLE },
  { name: 'rightAnkle', idx: LandmarkIndex.RIGHT_ANKLE },
];

const TRIPLETS: JointTriplet[] = [
  { joint: 'leftElbow', proximal: LandmarkIndex.LEFT_SHOULDER, vertex: LandmarkIndex.LEFT_ELBOW, distal: LandmarkIndex.LEFT_WRIST },
  { joint: 'rightElbow', proximal: LandmarkIndex.RIGHT_SHOULDER, vertex: LandmarkIndex.RIGHT_ELBOW, distal: LandmarkIndex.RIGHT_WRIST },
  { joint: 'leftKnee', proximal: LandmarkIndex.LEFT_HIP, vertex: LandmarkIndex.LEFT_KNEE, distal: LandmarkIndex.LEFT_ANKLE },
  { joint: 'rightKnee', proximal: LandmarkIndex.RIGHT_HIP, vertex: LandmarkIndex.RIGHT_KNEE, distal: LandmarkIndex.RIGHT_ANKLE },
  { joint: 'leftShoulder', proximal: LandmarkIndex.LEFT_ELBOW, vertex: LandmarkIndex.LEFT_SHOULDER, distal: LandmarkIndex.LEFT_HIP },
  { joint: 'rightShoulder', proximal: LandmarkIndex.RIGHT_ELBOW, vertex: LandmarkIndex.RIGHT_SHOULDER, distal: LandmarkIndex.RIGHT_HIP },
  { joint: 'leftHip', proximal: LandmarkIndex.LEFT_SHOULDER, vertex: LandmarkIndex.LEFT_HIP, distal: LandmarkIndex.LEFT_KNEE },
  { joint: 'rightHip', proximal: LandmarkIndex.RIGHT_SHOULDER, vertex: LandmarkIndex.RIGHT_HIP, distal: LandmarkIndex.RIGHT_KNEE },
];

const NEIGHBORS: Record<JointName, JointName[]> = {
  leftWrist: ['leftElbow'],
  leftElbow: ['leftWrist', 'leftShoulder'],
  leftShoulder: ['leftElbow', 'rightShoulder', 'leftHip'],
  rightWrist: ['rightElbow'],
  rightElbow: ['rightWrist', 'rightShoulder'],
  rightShoulder: ['rightElbow', 'leftShoulder', 'rightHip'],
  leftHip: ['leftShoulder', 'rightHip', 'leftKnee'],
  rightHip: ['rightShoulder', 'leftHip', 'rightKnee'],
  leftKnee: ['leftHip', 'leftAnkle'],
  rightKnee: ['rightHip', 'rightAnkle'],
  leftAnkle: ['leftKnee'],
  rightAnkle: ['rightKnee'],
};

function jointTriplet(joint: JointName): JointTriplet | undefined {
  return TRIPLETS.find((t) => t.joint === joint);
}

function getByIndex(frame: TemplateFrame, idx: LandmarkIndex): Vec3 | null {
  const lm = frame[idx];
  if (!lm) return null;
  return { x: lm.x, y: lm.y, z: lm.z };
}

export function analyzeTwoKeyframes(params: {
  start: TemplateFrame;
  end: TemplateFrame;
  templateIsUpperBody: boolean;
}): TwoKeyframeDescriptor {
  const { start, end, templateIsUpperBody } = params;

  const scores = JOINTS
    .filter((j) => (templateIsUpperBody ? j.idx <= LandmarkIndex.RIGHT_WRIST : true))
    .map((j) => {
      const a = start[j.idx];
      const b = end[j.idx];
      const visibilityOk =
        !!a &&
        !!b &&
        (a.visibility ?? 1) >= 0.4 &&
        (b.visibility ?? 1) >= 0.4;
      const posDelta = visibilityOk ? distance(a, b) : 0;
      const trip = jointTriplet(j.name);
      const angleDeltaDeg = trip ? computeAngleDeltaFromTemplate(start, end, trip) : 0;
      const moveScore = 0.7 * angleDeltaDeg + 0.3 * (posDelta * 180);
      return {
        joint: j.name,
        moveScore,
        angleDeltaDeg,
        posDelta,
        visibilityOk,
      };
    })
    .sort((a, b) => b.moveScore - a.moveScore);

  const movingJoint = scores.find((s) => s.visibilityOk)?.joint ?? scores[0]?.joint ?? 'leftElbow';

  // Choose reference = least-moving visible neighbor, else origin.
  const neighborList = NEIGHBORS[movingJoint] ?? [];
  const refCandidates = neighborList
    .map((n) => scores.find((s) => s.joint === n))
    .filter((s): s is NonNullable<typeof s> => !!s && s.visibilityOk)
    .sort((a, b) => a.moveScore - b.moveScore);
  const referenceJoint = (refCandidates[0]?.joint ?? 'origin') as TwoKeyframeDescriptor['referenceJoint'];

  // Rotation around reference: vector ref->moving at start vs end.
  const movingIdx = JOINTS.find((j) => j.name === movingJoint)?.idx ?? LandmarkIndex.LEFT_ELBOW;
  const refIdx = referenceJoint !== 'origin'
    ? (JOINTS.find((j) => j.name === referenceJoint)?.idx ?? null)
    : null;

  const startMoving = getByIndex(start, movingIdx);
  const endMoving = getByIndex(end, movingIdx);
  const startRef = refIdx != null ? getByIndex(start, refIdx) : { x: 0, y: 0, z: 0 };
  const endRef = refIdx != null ? getByIndex(end, refIdx) : { x: 0, y: 0, z: 0 };

  const vStart = startMoving && startRef ? safeUnitVector(startRef, startMoving) : ({ x: 0, y: 0, z: 0 } as const);
  const vEnd = endMoving && endRef ? safeUnitVector(endRef, endMoving) : ({ x: 0, y: 0, z: 0 } as const);
  const rotationDeltaDeg = angleBetweenVectors(vStart, vEnd);

  const translationDelta = startMoving && endMoving ? distance(startMoving, endMoving) : 0;

  return {
    movingJoint,
    referenceJoint,
    rotationDeltaDeg,
    translationDelta,
    debug: { templateIsUpperBody, moveScores: scores },
  };
}

