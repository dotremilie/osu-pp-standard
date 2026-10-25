// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { Slider, Spinner } from '../../Objects';
import { StandardDifficultyHitObject } from '../Preprocessing';
import { smootherstep, smoothstep } from './JulyAimMath';
import { JulySnapAimEvaluator } from './JulySnapAimEvaluator';

/** Flow movement contribution to July 2026 Aim. */
export class JulyFlowAimEvaluator {
  static evaluateDifficultyOf(current: StandardDifficultyHitObject, withSliderTravelDistance: boolean): number {
    const previous = current.previous(0) as StandardDifficultyHitObject | null;

    if (current.baseObject instanceof Spinner || current.index <= 1 ||
      previous?.baseObject instanceof Spinner || !previous) return 0;

    const previousPrevious = current.previous(1) as StandardDifficultyHitObject;
    const currentDistance = withSliderTravelDistance ? current.lazyJumpDistance : current.jumpDistance;
    const previousDistance = withSliderTravelDistance ? previous.lazyJumpDistance : previous.jumpDistance;
    let currentVelocity = currentDistance / current.adjustedDeltaTime;

    if (previous.baseObject instanceof Slider && withSliderTravelDistance) {
      currentVelocity = Math.max(currentVelocity,
        (previous.baseObject.lazyTravelDistance + current.lazyJumpDistance) / current.adjustedDeltaTime);
    }

    const previousVelocity = previousDistance / previous.adjustedDeltaTime;
    let difficulty = currentVelocity * Math.sqrt(current.smallCircleBonus);
    const timeDifference = Math.max(current.adjustedDeltaTime, previous.adjustedDeltaTime) -
      Math.min(current.adjustedDeltaTime, previous.adjustedDeltaTime);

    difficulty *= 1 + Math.min(0.25, Math.pow(timeDifference / 50, 4));

    if (current.angle !== null && previous.angle !== null) {
      const angleDifference = Math.abs(current.angle - previous.angle);
      const angularVelocity = Math.sin(angleDifference / 2) * 180 / (current.adjustedDeltaTime * 0.1);

      difficulty *= 0.8 + Math.sqrt(angularVelocity / 270);
    }

    let overlapWeight = 1;

    if (current.index > 2) {
      overlapWeight = 1 - this._overlap(current, previous) *
        this._overlap(current, previousPrevious) *
        this._overlap(previous, previousPrevious);
    }

    if (current.angle !== null) {
      difficulty += currentVelocity * JulySnapAimEvaluator.angleAcuteness(current.angle) * overlapWeight;
    }

    if (Math.max(previousVelocity, currentVelocity) !== 0) {
      if (withSliderTravelDistance) currentVelocity = currentDistance / current.adjustedDeltaTime;

      const velocityDifference = Math.abs(previousVelocity - currentVelocity);
      const distanceRatio = smoothstep(velocityDifference / Math.max(previousVelocity, currentVelocity), 0, 1);
      const overlapVelocityBuff = Math.min(
        125 / Math.min(current.adjustedDeltaTime, previous.adjustedDeltaTime),
        velocityDifference,
      );

      difficulty += overlapVelocityBuff * distanceRatio * overlapWeight * 0.52;
    }

    if (current.baseObject instanceof Slider && withSliderTravelDistance) {
      difficulty += current.travelDistance / current.travelTime;
    }

    return Math.pow(difficulty, 1.45) * smootherstep(currentDistance, 0, 50);
  }

  private static _overlap(first: StandardDifficultyHitObject, second: StandardDifficultyHitObject): number {
    const radius = first.baseObject.radius;
    const distance = first.baseObject.stackedStartPosition.fsubtract(second.baseObject.stackedStartPosition).flength();

    return Math.max(0, Math.min(1, 1 - Math.pow(Math.max(distance - radius, 0) / radius, 2)));
  }
}
