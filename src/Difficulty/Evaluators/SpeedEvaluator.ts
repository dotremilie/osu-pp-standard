// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { MathUtils } from 'osu-classes';
import { Spinner } from '../../Objects';
import { StandardDifficultyHitObject } from '../Preprocessing';

/** July 2026 per-object tapping difficulty before rhythm and strain accumulation. */
export class SpeedEvaluator {
  static evaluateDifficultyOf(current: StandardDifficultyHitObject): number {
    if (current.baseObject instanceof Spinner) return 0;

    let strainTime = current.adjustedDeltaTime;
    const next = current.next(0) as StandardDifficultyHitObject | null;
    const doubleTapFeasibility = 1 - current.calculateDoubleTapFeasibility(next);

    strainTime /= MathUtils.clamp((strainTime / current.hitWindowGreat) / 0.93, 0.92, 1);

    let speedBonus = 0;

    if (60000 / (strainTime * 4) > 200) {
      speedBonus = 0.75 * Math.pow((75 - strainTime) / 40, 2);
    }

    const speedDifficulty = (1 + speedBonus) * 1000 / strainTime;
    const highBpmBonus = 1 / (1 - Math.pow(0.3, current.adjustedDeltaTime / 1000));

    return speedDifficulty * highBpmBonus * doubleTapFeasibility;
  }
}
