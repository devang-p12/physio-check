export interface RawLandmark {
  x: number; // 0-1
  y: number; // 0-1
  z: number; // normalized depth
  visibility: number; // 0-1
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** MediaPipe Pose indices we rely on */
export const LandmarkIndex = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export type LandmarkIndex = (typeof LandmarkIndex)[keyof typeof LandmarkIndex];

export type TemplateFrame = Array<{ x: number; y: number; z: number; visibility: number }>;

export type MatchTier = 'strong' | 'soft' | 'none';

export type JointName =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle';

export interface JointTriplet {
  joint: JointName;
  proximal: LandmarkIndex;
  vertex: LandmarkIndex;
  distal: LandmarkIndex;
}

export interface TwoKeyframeDescriptor {
  movingJoint: JointName;
  referenceJoint: JointName | 'origin';
  rotationDeltaDeg: number;
  translationDelta: number;
  debug: {
    templateIsUpperBody: boolean;
    moveScores: Array<{
      joint: JointName;
      moveScore: number;
      angleDeltaDeg: number;
      posDelta: number;
      visibilityOk: boolean;
    }>;
  };
}

export type RepPhase = 'atStart' | 'movingToEnd' | 'atEnd' | 'movingToStart';

export interface CustomExerciseOutput {
  reps: number;
  phase: RepPhase;
  movingJoint: JointName | null;
  referenceJoint: JointName | 'origin' | null;
  rotationProgressDeg: number; // 0..rotationDeltaDeg-ish
  rotationDeltaDeg: number;
  translationDelta: number;
  matchTier: MatchTier;
  matchScore: number; // 0-100, deterministic
  feedback: string;
}

