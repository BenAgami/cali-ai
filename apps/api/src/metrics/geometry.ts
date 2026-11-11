import type { Point } from "./types";

const RAD_TO_DEG = 180 / Math.PI;

/** Angle in degrees at b between a-b and c-b. NaN when a point coincides with b. */
export const angleAt = (a: Point, b: Point, c: Point): number => {
  const v1x = a[0] - b[0];
  const v1y = a[1] - b[1];
  const v2x = c[0] - b[0];
  const v2y = c[1] - b[1];
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return Number.NaN;
  return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * RAD_TO_DEG;
};

/** Signed distance of the hip from the shoulder-ankle line over L; below (larger y) is positive regardless of facing. */
export const hipOffsetRatio = (
  shoulder: Point,
  hip: Point,
  ankle: Point,
): number => {
  const lx = ankle[0] - shoulder[0];
  const ly = ankle[1] - shoulder[1];
  const len = Math.hypot(lx, ly);
  if (len === 0) return Number.NaN;
  const cross = lx * (hip[1] - shoulder[1]) - ly * (hip[0] - shoulder[0]);
  return (lx >= 0 ? cross : -cross) / (len * len);
};

export const distance = (a: Point, b: Point): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Degrees (0-180) between the lower->upper vector and straight up (y down). */
export const angleFromVertical = (lower: Point, upper: Point): number => {
  const dx = upper[0] - lower[0];
  const dy = upper[1] - lower[1];
  if (dx === 0 && dy === 0) return Number.NaN;
  // straight up is (0, -1)
  return (
    Math.acos(Math.min(1, Math.max(-1, -dy / Math.hypot(dx, dy)))) * RAD_TO_DEG
  );
};

/** 100 at good, 0 at poor, linear and clamped; works for good < poor and good > poor. NaN in, NaN out. */
export const ramp = (value: number, good: number, poor: number): number => {
  if (Number.isNaN(value)) return Number.NaN;
  const t = (value - poor) / (good - poor);
  return Math.min(1, Math.max(0, t)) * 100;
};

export const mean = (values: readonly number[]): number =>
  values.length === 0
    ? Number.NaN
    : values.reduce((sum, v) => sum + v, 0) / values.length;

export const std = (values: readonly number[]): number => {
  if (values.length === 0) return Number.NaN;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

/** Linear-interpolated percentile, p in [0, 100]. */
export const percentile = (values: readonly number[], p: number): number => {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export const median = (values: readonly number[]): number =>
  percentile(values, 50);
