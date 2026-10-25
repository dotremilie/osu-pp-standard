// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { Slider, Spinner } from '../../Objects';
import { StandardDifficultyHitObject } from '../Preprocessing';
import { reverseLerp, smootherstep, smoothstep } from './AimMath';

/** Snap movement contribution to July 2026 Aim. */
export class SnapAimEvaluator {
  static evaluateDifficultyOf(current: StandardDifficultyHitObject, withSliderTravelDistance: boolean): number {
    const previous = current.previous(0) as StandardDifficultyHitObject | null;

    if (current.baseObject instanceof Spinner || current.index <= 1 ||
      previous?.baseObject instanceof Spinner || !previous) return 0;

    const previous2 = current.previous(2) as StandardDifficultyHitObject | null;
    const currentDistance = withSliderTravelDistance ? current.lazyJumpDistance : current.jumpDistance;
    const previousDistance = withSliderTravelDistance ? previous.lazyJumpDistance : previous.jumpDistance;
    let currentVelocity = currentDistance / current.adjustedDeltaTime;

    if (previous.baseObject instanceof Slider && withSliderTravelDistance) {
      currentVelocity = Math.max(currentVelocity,
        (previous.baseObject.lazyTravelDistance + current.lazyJumpDistance) / current.adjustedDeltaTime);
    }

    const previousVelocity = previousDistance / previous.adjustedDeltaTime;
    let difficulty = currentVelocity * this._vectorAngleRepetition(current, previous);

    if (current.angle !== null && previous.angle !== null) {
      const currentAngle = current.angle;
      const previousAngle = previous.angle;
      const velocityInfluence = Math.min(currentVelocity, previousVelocity);
      let acuteBonus = 0;

      if (Math.max(current.adjustedDeltaTime, previous.adjustedDeltaTime) <
        1.25 * Math.min(current.adjustedDeltaTime, previous.adjustedDeltaTime)) {
        acuteBonus = this.angleAcuteness(currentAngle);
        acuteBonus *= 0.08 + 0.92 * (1 - Math.min(acuteBonus, Math.pow(this.angleAcuteness(previousAngle), 3)));
        acuteBonus *= velocityInfluence *
          smootherstep(60000 / (current.adjustedDeltaTime * 2), 300, 400) *
          smootherstep(currentDistance, 0, 200);
      }

      let wideBonus = smoothstep(currentAngle, 40 * Math.PI / 180, 140 * Math.PI / 180);

      wideBonus *= 0.25 + 0.75 * (1 - Math.min(wideBonus,
        Math.pow(smoothstep(previousAngle, 40 * Math.PI / 180, 140 * Math.PI / 180), 3)));

      let wideCurrentVelocity = currentDistance / Math.pow(current.adjustedDeltaTime, 1.45);
      const widePreviousVelocity = previousDistance / Math.pow(previous.adjustedDeltaTime, 1.45);

      if (previous.baseObject instanceof Slider && withSliderTravelDistance) {
        wideCurrentVelocity = Math.max(wideCurrentVelocity,
          (previous.baseObject.lazyTravelDistance + current.lazyJumpDistance) / Math.pow(current.adjustedDeltaTime, 1.45));
      }

      wideBonus *= Math.min(wideCurrentVelocity, widePreviousVelocity);

      if (previous2) {
        const distance = previous2.baseObject.stackedStartPosition.fsubtract(
          previous.baseObject.stackedStartPosition,
        ).flength();

        if (distance < 1) wideBonus *= 1 - 0.55 * (1 - distance);
      }

      difficulty += Math.max(acuteBonus * 2.41, wideBonus * 9.67);

      const wiggleBonus = velocityInfluence *
        smootherstep(currentDistance, 50, 100) *
        Math.pow(reverseLerp(currentDistance, 300, 100), 1.8) *
        smootherstep(currentAngle, 110 * Math.PI / 180, 60 * Math.PI / 180) *
        smootherstep(previousDistance, 50, 100) *
        Math.pow(reverseLerp(previousDistance, 300, 100), 1.8) *
        smootherstep(previousAngle, 110 * Math.PI / 180, 60 * Math.PI / 180);

      difficulty += wiggleBonus * 1.02;
    }

    if (Math.max(previousVelocity, currentVelocity) !== 0) {
      if (withSliderTravelDistance) currentVelocity = currentDistance / current.adjustedDeltaTime;

      const velocityDifference = Math.abs(previousVelocity - currentVelocity);
      const distanceRatio = smoothstep(velocityDifference / Math.max(previousVelocity, currentVelocity), 0, 1);
      const overlapVelocityBuff = Math.min(
        125 / Math.min(current.adjustedDeltaTime, previous.adjustedDeltaTime), velocityDifference,
      );
      const rhythmRatio = Math.min(current.adjustedDeltaTime, previous.adjustedDeltaTime) /
        Math.max(current.adjustedDeltaTime, previous.adjustedDeltaTime);

      difficulty += overlapVelocityBuff * distanceRatio * Math.pow(rhythmRatio, 2) * 0.9;
    }

    if (current.baseObject instanceof Slider && withSliderTravelDistance) {
      const sliderBonus = current.travelDistance / current.travelTime;

      difficulty += (sliderBonus < 1 ? sliderBonus : Math.pow(sliderBonus, 0.75)) * 1.5;
    }

    difficulty *= current.smallCircleBonus;

    return difficulty / (1 - Math.pow(0.03, Math.pow(current.adjustedDeltaTime / 1000, 0.65)));
  }

  static angleAcuteness(angle: number): number {
    return smoothstep(angle, 140 * Math.PI / 180, 40 * Math.PI / 180);
  }

  private static _vectorAngleRepetition(current: StandardDifficultyHitObject,
    previous: StandardDifficultyHitObject): number {
    if (current.angle === null || previous.angle === null) return 1;

    let constantAngleCount = 0;

    for (let index = 0; index < 6; ++index) {
      const earlier = current.previous(index) as StandardDifficultyHitObject | null;
      if (!earlier) break;

      if (Math.max(current.adjustedDeltaTime, earlier.adjustedDeltaTime) >
        1.1 * Math.min(current.adjustedDeltaTime, earlier.adjustedDeltaTime)) break;

      if (earlier.normalisedVectorAngle !== null && current.normalisedVectorAngle !== null) {
        const angleDifference = Math.abs(current.normalisedVectorAngle - earlier.normalisedVectorAngle);

        constantAngleCount += Math.cos(8 * Math.min(Math.PI / 16, angleDifference));
      }
    }

    const vectorRepetition = Math.pow(Math.min(0.5 / constantAngleCount, 1), 2);
    const stackFactor = smootherstep(current.lazyJumpDistance, 0, 100);
    const angleDifference = Math.abs(current.angle - previous.angle);
    const angleDifferenceAdjusted = Math.cos(2 * Math.min(Math.PI / 4, angleDifference * stackFactor));
    const baseNerf = 1 - 0.15 * this.angleAcuteness(previous.angle) * angleDifferenceAdjusted;

    return Math.pow(baseNerf + (1 - baseNerf) * vectorRepetition * 0.5 * stackFactor, 2);
  }
}
