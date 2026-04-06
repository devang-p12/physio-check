import type { Vec3 } from '../types';

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function distance(a: Vec3, b: Vec3): number {
  return magnitude(subtract(a, b));
}

export function normalize(v: Vec3): Vec3 {
  const m = magnitude(v);
  if (m < 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

