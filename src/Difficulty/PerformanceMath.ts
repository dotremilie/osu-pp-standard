// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.

export function erf(value: number): number {
  if (value === 0) return 0;
  if (value === Infinity) return 1;
  if (value === -Infinity) return -1;
  if (Number.isNaN(value)) return NaN;

  const t = 1 / (1 + 0.3275911 * Math.abs(value));
  const tau = t * (0.254829592 + t * (-0.284496736 + t *
    (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - tau * Math.exp(-value * value);

  return value >= 0 ? result : -result;
}

export function erfInv(value: number): number {
  if (value <= -1) return -Infinity;
  if (value >= 1) return Infinity;
  if (value === 0) return 0;

  const sign = Math.sign(value);
  const x = Math.abs(value);
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const t1 = 2 / (Math.PI * a) + ln / 2;
  const t2 = ln / a;
  const baseApprox = Math.sqrt(t1 * t1 - t2) - t1;
  const correction = x >= 0.85 ? Math.pow((x - 0.85) / 0.293, 8) : 0;

  return sign * (Math.sqrt(baseApprox) + correction);
}

export function norm(exponent: number, ...values: number[]): number {
  return Math.pow(values.reduce((sum, value) => sum + Math.pow(value, exponent), 0), 1 / exponent);
}

export function cognitionValue(reading: number, flashlight: number): number {
  if (reading <= 0) return flashlight;
  if (flashlight <= 0) return reading;

  const flashlightFactor = Math.max(0.25, Math.min(1, flashlight / reading));

  return norm(1.1, reading, flashlight * flashlightFactor);
}
