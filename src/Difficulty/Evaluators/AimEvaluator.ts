// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject } from 'osu-classes';
import { StandardModCombination, StandardRelax, StandardTouchDevice } from '../../Mods';
import { StandardDifficultyHitObject } from '../Preprocessing';
import { AgilityEvaluator } from './AgilityEvaluator';
import { FlowAimEvaluator } from './FlowAimEvaluator';
import { SnapAimEvaluator } from './SnapAimEvaluator';

/** Combines the July 2026 aim components under Kionell's evaluator name. */
export class AimEvaluator {
  static evaluateDifficultyOf(current: DifficultyHitObject, withSliders: boolean,
    mods = new StandardModCombination()): number {
    const standardCurrent = current as StandardDifficultyHitObject;
    const snap = SnapAimEvaluator.evaluateDifficultyOf(standardCurrent, withSliders) * 70.9;
    const agility = AgilityEvaluator.evaluateDifficultyOf(standardCurrent) * 2.35;
    let flow = FlowAimEvaluator.evaluateDifficultyOf(standardCurrent, withSliders) * 242;
    let combinedSnap = Math.pow(Math.pow(snap, 1.2) + Math.pow(agility, 1.2), 1 / 1.2);
    const ratio = flow / combinedSnap;
    const snapProbability = ratio === 0 ? 0 : Number.isNaN(ratio)
      ? 1 : 1 / (1 + Math.exp(-7.27 * Math.log(ratio)));

    if (mods.any(StandardTouchDevice)) {
      combinedSnap = Math.pow(Math.pow(Math.pow(snap, 0.89), 1.2) + Math.pow(agility, 1.2), 1 / 1.2);
    }

    if (mods.any(StandardRelax)) {
      combinedSnap *= 0.75;
      flow *= 0.6;
    }

    const total = (combinedSnap * snapProbability + flow * (1 - snapProbability)) * 1.12;

    return total * (0.985 + Math.pow(Math.max(0, standardCurrent.overallDifficulty), 2) / 4000);
  }
}
