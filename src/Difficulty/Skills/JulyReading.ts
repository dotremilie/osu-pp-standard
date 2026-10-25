// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject } from 'osu-classes';
import { StandardAutopilot, StandardHidden, StandardRelax, StandardTouchDevice } from '../../Mods';
import { JulyReadingEvaluator } from '../Evaluators/JulyReadingEvaluator';
import { StandardDifficultyHitObject } from '../Preprocessing';
import { HarmonicSkill } from './HarmonicSkill';

/** July 2026 reading skill, kept internal until the complete rating port. */
export class JulyReading extends HarmonicSkill {
  private _currentStrain = 0;
  private readonly _objects: DifficultyHitObject[] = [];

  protected _objectDifficultyOf(current: DifficultyHitObject): number {
    this._objects.push(current);

    const standardCurrent = current as StandardDifficultyHitObject;
    const decay = Math.pow(0.8, current.deltaTime / 1000);
    let difficulty = JulyReadingEvaluator.evaluateDifficultyOf(
      standardCurrent,
      this._mods.any(StandardHidden),
    );

    if (this._mods.any(StandardTouchDevice)) difficulty = Math.pow(difficulty, 0.89);
    if (this._mods.any(StandardRelax)) difficulty *= 0.4;
    if (this._mods.any(StandardAutopilot)) difficulty *= 0.1;

    difficulty *= 0.825 + Math.pow(Math.max(0, standardCurrent.overallDifficulty), 2.2) / 1125;

    this._currentStrain *= decay;
    this._currentStrain += difficulty * (1 - decay) * 2.5;

    return this._currentStrain;
  }

  protected _getTransformedDifficulties(difficulties: number[]): number[] {
    const positive = difficulties.filter((value) => value > 0);
    if (this._objects.length === 0) return positive;

    const reducedDuration = this._objects[0].startTime + 60000;
    const reducedNoteCount = this._objects.findIndex((object) => object.startTime > reducedDuration);
    const count = reducedNoteCount < 0 ? this._objects.length : reducedNoteCount;

    for (let i = 0; i < Math.min(positive.length, count); ++i) {
      positive[i] *= Math.log10(1 + 9 * i / count);
    }

    return positive;
  }

  countTopWeightedObjectDifficulties(difficultyValue: number): number {
    if (this._objectDifficulties.length === 0 || this._objectWeightSum === 0) return 0;

    const consistentTopObject = difficultyValue / this._objectWeightSum;
    if (consistentTopObject === 0) return 0;

    return this._objectDifficulties.reduce((sum, value) => {
      return sum + 1.1 / (1 + Math.exp(5 * (1.15 - value / consistentTopObject)));
    }, 0);
  }
}
