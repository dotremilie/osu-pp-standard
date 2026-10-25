// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject } from 'osu-classes';
import { StandardAutopilot, StandardRelax } from '../../Mods';
import { Slider } from '../../Objects';
import { RhythmEvaluator } from '../Evaluators/RhythmEvaluator';
import { SpeedEvaluator } from '../Evaluators/SpeedEvaluator';
import { StandardDifficultyHitObject } from '../Preprocessing';
import { HarmonicSkill } from './HarmonicSkill';

/** osu!standard speed skill from the July 2026 rework. */
export class Speed extends HarmonicSkill {
  private _currentStrain = 0;
  private readonly _sliderStrains: number[] = [];

  protected get _harmonicScale(): number {
    return 20;
  }

  protected _objectDifficultyOf(current: DifficultyHitObject): number {
    if (this._mods.any(StandardRelax)) return 0;

    const standardCurrent = current as StandardDifficultyHitObject;
    const decay = Math.pow(0.3, standardCurrent.adjustedDeltaTime / 1000);
    let difficulty = SpeedEvaluator.evaluateDifficultyOf(standardCurrent);

    if (this._mods.any(StandardAutopilot)) difficulty *= 0.5;

    this._currentStrain *= decay;
    this._currentStrain += difficulty * (1 - decay) * 1.16;

    const totalStrain = this._currentStrain * RhythmEvaluator.evaluateDifficultyOf(standardCurrent);

    if (standardCurrent.baseObject instanceof Slider) this._sliderStrains.push(totalStrain);

    return totalStrain;
  }

  relevantObjectCount(): number {
    if (this._objectDifficulties.length === 0) return 0;

    const maxStrain = Math.max(...this._objectDifficulties);

    if (maxStrain === 0) return 0;

    return this._objectDifficulties.reduce((sum, strain) => {
      return sum + 1 / (1 + Math.exp(-(strain / maxStrain * 12 - 6)));
    }, 0);
  }

  countTopWeightedSliders(difficultyValue: number): number {
    if (this._sliderStrains.length === 0 || this._objectWeightSum === 0) return 0;

    const consistentTopObject = difficultyValue / this._objectWeightSum;

    if (consistentTopObject === 0) return 0;

    return this._sliderStrains.reduce((sum, strain) => {
      return sum + 1.1 / (1 + Math.exp(10 * (0.88 - strain / consistentTopObject)));
    }, 0);
  }
}
