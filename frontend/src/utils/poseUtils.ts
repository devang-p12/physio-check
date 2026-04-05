export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Maps normalized mediapipe coordinates to canvas pixels
 */
export function getLandmarkCoords(landmark: Landmark, canvasWidth: number, canvasHeight: number) {
  return {
    x: landmark.x * canvasWidth,
    y: landmark.y * canvasHeight,
  };
}

/**
 * Calculates angle between three landmarks in degrees (vertex at b)
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };

  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);

  if (mag === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

/**
 * Draws a filled circle at the given landmark pixel coordinates
 */
export function drawLandmarkCircle(
  ctx: CanvasRenderingContext2D,
  landmark: Landmark,
  radius: number,
  color: string,
  canvasWidth: number,
  canvasHeight: number
) {
  if ((landmark.visibility ?? 1) < 0.5) return;
  const coords = getLandmarkCoords(landmark, canvasWidth, canvasHeight);
  ctx.beginPath();
  ctx.arc(coords.x, coords.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draws an arc representing the joint angle
 */
export function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  vertex: Landmark,
  angle: number,
  radius: number,
  color: string,
  canvasWidth: number,
  canvasHeight: number,
  labelPrefix: string = ""
) {
  if ((vertex.visibility ?? 1) < 0.5) return;
  const coords = getLandmarkCoords(vertex, canvasWidth, canvasHeight);
  
  // Draw the arc
  ctx.beginPath();
  ctx.arc(coords.x, coords.y, radius, 0, (angle * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw the numeric text
  ctx.fillStyle = color;
  ctx.font = "bold 18px Inter, sans-serif";
  ctx.fillText(`${labelPrefix}${Math.round(angle)}°`, coords.x + radius + 10, coords.y);
}

/**
 * Draws connecting lines between two landmarks
 */
export function drawSkeletonLine(
  ctx: CanvasRenderingContext2D,
  l1: Landmark,
  l2: Landmark,
  color: string,
  canvasWidth: number,
  canvasHeight: number
) {
  if ((l1.visibility ?? 1) < 0.5 || (l2.visibility ?? 1) < 0.5) return;
  const c1 = getLandmarkCoords(l1, canvasWidth, canvasHeight);
  const c2 = getLandmarkCoords(l2, canvasWidth, canvasHeight);

  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
}
