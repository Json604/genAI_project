export function blend(imageVec: number[], textVec: number[], alpha: number): number[] {
  const mixed = imageVec.map((v, i) => alpha * v + (1 - alpha) * textVec[i]);
  const norm = Math.hypot(...mixed) || 1;
  return mixed.map((v) => v / norm);
}
