import { getPoseSimilarity } from "./customPoseLogic";

export class TemplateMatcher {
  private template: any[][];
  private threshold: number = 0.15; // How close they need to be (lower = stricter)
  private currentState: 'START' | 'MID' | 'FINISH' = 'START';

  constructor(recordedTemplate: any[][]) {
    this.template = recordedTemplate;
  }

  // Find the frame in the recording that is most "different" from the start
  // This is usually the bottom of a squat or the top of a curl.
  getMidPointFrame() {
    return Math.floor(this.template.length / 2);
  }

  checkProgress(livePose: any[], onRepComplete: () => void) {
    const startFrame = this.template[0];
    const midFrame = this.template[this.getMidPointFrame()];
    const endFrame = this.template[this.template.length - 1];

    const distToStart = getPoseSimilarity(livePose, startFrame);
    const distToMid = getPoseSimilarity(livePose, midFrame);

    // STATE MACHINE LOGIC
    if (this.currentState === 'START' && distToMid < this.threshold) {
      this.currentState = 'MID';
    } 
    else if (this.currentState === 'MID' && distToStart < this.threshold) {
      this.currentState = 'START';
      onRepComplete(); // A full rep is completed when they return to start
      return "correct";
    }

    // Posture Check: If they are too far from ANY valid frame in the template
    const minDistance = Math.min(distToStart, distToMid);
    return minDistance < 0.3 ? "correct" : "incorrect";
  }
}