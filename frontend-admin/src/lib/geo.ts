export interface Point {
  x: number;
  y: number;
}

export function ring(cx: number, cy: number, rx: number, ry: number): Point[] {
  return Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 7 - 0.5;
    return {
      x: Math.round((cx + Math.cos(a) * rx) * 10) / 10,
      y: Math.round((cy + Math.sin(a) * ry) * 10) / 10,
    };
  });
}

export function inside(point: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crosses = (pi.y > point.y) !== (pj.y > point.y);
    if (crosses && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + 0.0001) + pi.x) hit = !hit;
  }
  return hit;
}

export function pointsAttr(points: Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
