import KneeExtensionExercise from '../components/exercises/KneeExtensionExercise';
import ShoulderAbductionExercise from '../components/exercises/ShoulderAbductionExercise';
import HipHingeExercise from '../components/exercises/HipHingeExercise';
import CalfRaiseExercise from '../components/exercises/CalfRaiseExercise';
import LateralLegRaiseExercise from '../components/exercises/LateralLegRaiseExercise';
import KneeFlexionExercise from '../components/exercises/KneeFlexionExercise';
import ShoulderFlexionExercise from '../components/exercises/ShoulderFlexionExercise';
import SideBendExercise from '../components/exercises/SideBendExercise';
import SingleLegBalanceExercise from '../components/exercises/SingleLegBalanceExercise';
import ElbowFlexionExercise from '../components/exercises/ElbowFlexionExercise';

export const EXERCISES = [
  { id: 'knee_extension', name: 'Knee Extension', component: KneeExtensionExercise },
  { id: 'shoulder_abduction', name: 'Shoulder Abduction', component: ShoulderAbductionExercise },
  { id: 'hip_hinge', name: 'Hip Hinge', component: HipHingeExercise },
  { id: 'calf_raise', name: 'Calf Raise', component: CalfRaiseExercise },
  { id: 'lateral_leg_raise', name: 'Lateral Leg Raise', component: LateralLegRaiseExercise },
  { id: 'knee_flexion', name: 'Knee Flexion', component: KneeFlexionExercise },
  { id: 'shoulder_flexion', name: 'Shoulder Flexion', component: ShoulderFlexionExercise },
  { id: 'side_bend', name: 'Side Bend', component: SideBendExercise },
  { id: 'single_leg_balance', name: 'Single Leg Balance', component: SingleLegBalanceExercise },
  { id: 'elbow_flexion', name: 'Elbow Flexion', component: ElbowFlexionExercise },
];
