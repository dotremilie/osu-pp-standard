// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { MathUtils } from 'osu-classes';
import { Spinner } from '../../Objects';
import { StandardDifficultyHitObject } from '../Preprocessing';

/** July 2026 per-object reading difficulty before strain accumulation. */
export class ReadingEvaluator {
  private static readonly READING_WINDOW = 3000;
  private static readonly DISTANCE_THRESHOLD = 150;

  static evaluateDifficultyOf(current: StandardDifficultyHitObject, hidden: boolean): number {
    if (current.baseObject instanceof Spinner || current.index === 0) return 0;

    const next = current.next(0) as StandardDifficultyHitObject | null;
    const velocity = Math.max(1, current.lazyJumpDistance / current.adjustedDeltaTime);
    const visibleDensity = this._currentVisibleObjectDensity(current);
    const pastInfluence = this._pastObjectDifficultyInfluence(current);
    const angleNerf = this._constantAngleNerfFactor(current);

    let futureInfluence = Math.sqrt(visibleDensity);
    if (next) futureInfluence *= this._smootherstep(next.lazyJumpDistance, 15, this.DISTANCE_THRESHOLD);

    const density = Math.pow(
      Math.max(0, Math.pow(pastInfluence + futureInfluence, 1.7) * 0.4 * angleNerf * velocity - 2.5),
      0.45,
    ) * 2.4;

    const preempt = Math.pow(Math.max(0, 500 - current.preempt), 2.5) / 140000 * angleNerf * velocity;

    let hiddenDifficulty = 0;

    if (hidden) {
      const preemptFactor = Math.pow(current.preempt, 2.2) * 0.01;
      const densityFactor = Math.pow(visibleDensity + pastInfluence, 3.3) * 3;

      hiddenDifficulty = Math.pow(
        (preemptFactor + densityFactor) * angleNerf * velocity * 0.01,
        0.4,
      ) * 0.28;

      const previous = current.previous(0) as StandardDifficultyHitObject | null;

      if (previous && current.lazyJumpDistance === 0 &&
        current.opacityAt(previous.baseObject.startTime, true) === 0 &&
        previous.startTime > current.startTime - current.preempt) {
        hiddenDifficulty += 0.28 * 2500 / Math.pow(current.adjustedDeltaTime, 1.5);
      }
    }

    const difficulty = Math.pow(
      Math.pow(preempt, 1.5) + Math.pow(hiddenDifficulty, 1.5) + Math.pow(density, 1.5),
      1 / 1.5,
    );

    return difficulty / (1 - Math.pow(0.8, current.adjustedDeltaTime / 1000));
  }

  private static _pastObjectDifficultyInfluence(current: StandardDifficultyHitObject): number {
    let influence = 0;

    for (let i = 0; i < current.index; ++i) {
      const previous = current.previous(i) as StandardDifficultyHitObject | null;

      if (!previous || current.startTime - previous.startTime > this.READING_WINDOW ||
        previous.startTime < current.startTime - current.preempt) break;

      influence += current.opacityAt(previous.baseObject.startTime, false) *
        this._smootherstep(previous.lazyJumpDistance, 15, this.DISTANCE_THRESHOLD) *
        this._timeNerf(current.startTime - previous.startTime);
    }

    return influence;
  }

  private static _currentVisibleObjectDensity(current: StandardDifficultyHitObject): number {
    let density = 0;
    let next = current.next(0) as StandardDifficultyHitObject | null;

    while (next) {
      if (next.startTime - current.startTime > this.READING_WINDOW ||
        current.startTime < next.startTime - next.preempt) break;

      density += next.opacityAt(current.baseObject.startTime, false) *
        this._timeNerf(next.startTime - current.startTime);

      next = next.next(0) as StandardDifficultyHitObject | null;
    }

    return density;
  }

  private static _constantAngleNerfFactor(current: StandardDifficultyHitObject): number {
    let constantAngleCount = 0;
    let index = 0;
    let currentTimeGap = 0;
    let previous0: StandardDifficultyHitObject = current;
    let previous1: StandardDifficultyHitObject | null = null;
    let previous2: StandardDifficultyHitObject | null = null;

    while (currentTimeGap < 2000) {
      const loop = current.previous(index) as StandardDifficultyHitObject | null;
      if (!loop) break;

      const longIntervalFactor = 1 - this._reverseLerp(loop.adjustedDeltaTime, 200, 2000);

      if (loop.angle !== null && current.angle !== null) {
        const difference = Math.abs(current.angle - loop.angle);
        let alternating = Math.PI;

        if (previous0.angle !== null && previous1 !== null && previous1.angle !== null &&
          previous2 !== null && previous2.angle !== null) {
          alternating = Math.abs(previous1.angle - loop.angle) +
            Math.abs(previous2.angle - previous0.angle);

          const weight = this._reverseLerp(Math.min(loop.angle, previous0.angle) * 180 / Math.PI, 20, 5) *
            this._reverseLerp(Math.max(loop.angle, previous0.angle) * 180 / Math.PI, 60, 120);

          alternating = Math.PI + (0.1 * alternating - Math.PI) * weight;
        }

        const stackFactor = this._smootherstep(loop.lazyJumpDistance, 0, 50);

        constantAngleCount += Math.cos(
          3 * Math.min(Math.PI / 6, Math.min(difference, alternating) * stackFactor),
        ) * longIntervalFactor;
      }

      currentTimeGap = current.startTime - loop.startTime;
      index++;
      previous2 = previous1;
      previous1 = previous0;
      previous0 = loop;
    }

    return MathUtils.clamp(2 / constantAngleCount, 0.2, 1);
  }

  private static _timeNerf(deltaTime: number): number {
    return MathUtils.clamp(2 - deltaTime / (this.READING_WINDOW / 2), 0, 1);
  }

  private static _reverseLerp(value: number, start: number, end: number): number {
    return MathUtils.clamp((value - start) / (end - start), 0, 1);
  }

  private static _smootherstep(value: number, start: number, end: number): number {
    const x = this._reverseLerp(value, start, end);

    return x * x * x * (x * (6 * x - 15) + 10);
  }
}
