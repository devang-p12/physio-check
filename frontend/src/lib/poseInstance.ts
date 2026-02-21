import { Pose, Results } from "@mediapipe/pose";

type ResultsCallback = (r: Results) => void;

let pose: Pose | null = null;
let initPromise: Promise<Pose> | null = null;
let currentCallback: ResultsCallback | null = null;

export async function getSharedPose(onResults: ResultsCallback): Promise<Pose> {
  currentCallback = onResults;

  if (initPromise) {
    const p = await initPromise;
    p.onResults(onResults);
    return p;
  }

  initPromise = (async () => {
    pose = new Pose({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`,
    });
    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults((r: Results) => {
      currentCallback?.(r);
    });
    await pose.initialize();
    return pose;
  })();

  return initPromise;
}

export function updatePoseCallback(onResults: ResultsCallback) {
  currentCallback = onResults;
}

export async function sendToPose(image: HTMLVideoElement | HTMLCanvasElement) {
  if (pose) await pose.send({ image });
}