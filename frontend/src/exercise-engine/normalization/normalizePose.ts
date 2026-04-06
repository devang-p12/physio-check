import type { RawLandmark, TemplateFrame, Vec3 } from '../types';
import { LandmarkIndex } from '../types';
import { midpoint } from '../math/vector';

export const FULL_BODY_IDX: readonly number[] = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] as const;
export const UPPER_BODY_IDX: readonly number[] = [11, 12, 13, 14, 15, 16] as const;

export function normalizePoseToShoulders(raw: RawLandmark[], idxList: readonly number[]): TemplateFrame | null {
  const lS = raw[LandmarkIndex.LEFT_SHOULDER];
  const rS = raw[LandmarkIndex.RIGHT_SHOULDER];
  if (!lS || !rS) return null;
  if ((lS.visibility ?? 1) < 0.3 || (rS.visibility ?? 1) < 0.3) return null;

  const center: Vec3 = midpoint(lS, rS);
  const shoulderWidth = Math.sqrt((lS.x - rS.x) ** 2 + (lS.y - rS.y) ** 2);
  if (shoulderWidth < 1e-4) return null;

  return idxList.map((i) => {
    const lm = raw[i];
    if (!lm) return { x: 0, y: 0, z: 0, visibility: 0 };
    return {
      x: (lm.x - center.x) / shoulderWidth,
      y: (lm.y - center.y) / shoulderWidth,
      z: (lm.z - center.z) / shoulderWidth,
      visibility: lm.visibility ?? 1,
    };
  });
}

