import type { Vec3, JointTriplet, TemplateFrame } from '../types';
import { subtract, dot, magnitude, normalize as normVec } from './vector';

export function angleBetweenVectors(a: Vec3, b: Vec3): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma < 1e-6 || mb < 1e-6) return 0;
  const cos = Math.min(1, Math.max(-1, dot(a, b) / (ma * mb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function angleBetweenThreePoints(proximal: Vec3, vertex: Vec3, distal: Vec3): number {
  const BA = subtract(vertex, proximal);
  const BC = subtract(vertex, distal);
  return angleBetweenVectors(BA, BC);
}

export function signedProgressDeg(params: {
  currentVec: Vec3;
  startVec: Vec3;
  endVec: Vec3;
}): number {
  const { currentVec, startVec, endVec } = params;
  // Deterministic scalar progress: closer-to-end => higher progress.
  const a = angleBetweenVectors(currentVec, startVec);
  const b = angleBetweenVectors(currentVec, endVec);
  const total = Math.max(1e-6, angleBetweenVectors(startVec, endVec));
  // If current is closer to end, progress approaches total.
  const t = Math.min(1, Math.max(0, 1 - b / total));
  return t * total;
}

export function computeAngleDeltaFromTemplate(frameA: TemplateFrame, frameB: TemplateFrame, triplet: JointTriplet): number {
  const aP = frameA[triplet.proximal];
  const aV = frameA[triplet.vertex];
  const aD = frameA[triplet.distal];
  const bP = frameB[triplet.proximal];
  const bV = frameB[triplet.vertex];
  const bD = frameB[triplet.distal];
  if (!aP || !aV || !aD || !bP || !bV || !bD) return 0;
  const visOk =
    (aP.visibility ?? 1) >= 0.4 &&
    (aV.visibility ?? 1) >= 0.4 &&
    (aD.visibility ?? 1) >= 0.4 &&
    (bP.visibility ?? 1) >= 0.4 &&
    (bV.visibility ?? 1) >= 0.4 &&
    (bD.visibility ?? 1) >= 0.4;
  if (!visOk) return 0;
  const angA = angleBetweenThreePoints(aP, aV, aD);
  const angB = angleBetweenThreePoints(bP, bV, bD);
  return Math.abs(angA - angB);
}

export function safeUnitVector(from: Vec3, to: Vec3): Vec3 {
  return normVec(subtract(from, to));
}

