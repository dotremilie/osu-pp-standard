// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { Slider, Spinner } from '../../Objects';
import { StandardDifficultyHitObject } from '../Preprocessing';

/** Cursor speed contribution to July 2026 Aim. */
export class JulyAgilityEvaluator {
  static evaluateDifficultyOf(current: StandardDifficultyHitObject): number {
    if (current.baseObject instanceof Spinner) return 0;

    const previous = current.index > 0 ? current.previous(0) as StandardDifficultyHitObject : null;
    const distance = (previous?.baseObject instanceof Slider ? previous.baseObject.lazyTravelDistance : 0) +
      current.lazyJumpDistance;
    const distanceScaled = Math.min(distance, 120) / 120;
    const difficulty = distanceScaled * 1000 / current.adjustedDeltaTime *
      Math.pow(current.smallCircleBonus, 1.5);

    return difficulty / (1 - Math.pow(0.2, current.adjustedDeltaTime / 1000));
  }
}
