export const drawRect = (
  detections: any[],
  ctx: CanvasRenderingContext2D
): void => {
  detections.forEach(prediction => {
    const [x, y, width, height] = prediction.bbox;

    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#00FF00";
    ctx.font = "16px Arial";
    ctx.fillText(
      `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
      x,
      y > 10 ? y - 5 : 10
    );
  });
};