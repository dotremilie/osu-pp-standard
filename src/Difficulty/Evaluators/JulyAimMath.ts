// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { MathUtils } from 'osu-classes';

export function reverseLerp(value: number, start: number, end: number): number {
  return MathUtils.clamp((value - start) / (end - start), 0, 1);
}

export function smoothstep(value: number, start: number, end: number): number {
  const x = reverseLerp(value, start, end);

  return x * x * (3 - 2 * x);
}

export function smootherstep(value: number, start: number, end: number): number {
  const x = reverseLerp(value, start, end);

  return x * x * x * (x * (6 * x - 15) + 10);
}
