import { getPoseSimilarity, createMasterTemplate } from "./customPoseLogic";

export class TemplateMatcher {
  private template: any[][];
  private peakFrame: any[];
  private startFrame: any[];
  private threshold: number;
  private currentState: "START" | "MID" = "START";

  constructor(recordedBuffer: any[][]) {
    const master = createMasterTemplate(recordedBuffer);

    if (!master) {
      // Fallback: treat the raw buffer as the template
      this.template   = recordedBuffer;
      this.startFrame = recordedBuffer[0];
      this.peakFrame  = recordedBuffer[Math.floor(recordedBuffer.length / 2)];
      this.threshold  = 0.22;
    } else {
      this.template   = master.fullSequence;
      this.startFrame = master.startFrame;
      this.peakFrame  = master.peakFrame;
      this.threshold  = master.difficultyThreshold; // 0.22
    }
  }

  checkProgress(livePose: any[], onRepComplete: () => void): "correct" | "incorrect" {
    const distToStart = getPoseSimilarity(livePose, this.startFrame);
    const distToPeak  = getPoseSimilarity(livePose, this.peakFrame);

    if (this.currentState === "START" && distToPeak < this.threshold) {
      this.currentState = "MID";
    } else if (this.currentState === "MID" && distToStart < this.threshold) {
      this.currentState = "START";
      onRepComplete();
      return "correct";
    }

    // Posture quality: how close are they to any valid waypoint
    const minDistance = Math.min(distToStart, distToPeak);
    return minDistance < 0.35 ? "correct" : "incorrect";
  }

  reset() {
    this.currentState = "START";
  }
}