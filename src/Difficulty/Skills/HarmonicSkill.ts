// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject } from 'osu-classes';
import { JulySkill } from './JulySkill';

/** Per-object difficulty summation used by Reading and Speed in July 2026. */
export abstract class HarmonicSkill extends JulySkill {
  protected _objectWeightSum = 0;

  protected get _harmonicScale(): number {
    return 1;
  }

  protected get _decayExponent(): number {
    return 0.9;
  }

  protected _processObject(current: DifficultyHitObject): number {
    return this._objectDifficultyOf(current);
  }

  protected abstract _objectDifficultyOf(current: DifficultyHitObject): number;

  protected _getTransformedDifficulties(difficulties: number[]): number[] {
    return difficulties;
  }

  get difficultyValue(): number {
    this._objectWeightSum = 0;

    const difficulties = this._getTransformedDifficulties([...this._objectDifficulties])
      .filter((value) => value > 0)
      .sort((a, b) => b - a);

    let difficulty = 0;

    difficulties.forEach((value, index) => {
      const scale = this._harmonicScale / (1 + index);
      const weight = (1 + scale) / (Math.pow(index, this._decayExponent) + 1 + scale);

      this._objectWeightSum += weight;
      difficulty += value * weight;
    });

    return difficulty;
  }

  countTopWeightedObjectDifficulties(difficultyValue: number): number {
    if (this._objectWeightSum === 0) return 0;

    const consistentTopObject = difficultyValue / this._objectWeightSum;
    if (consistentTopObject === 0) return 0;

    return this._objectDifficulties.reduce((sum, value) => {
      const logistic = 1.1 / (1 + Math.exp(10 * (0.88 - value / consistentTopObject)));

      return sum + logistic;
    }, 0);
  }

  static difficultyToPerformance(difficulty: number): number {
    return 4 * Math.pow(difficulty, 3);
  }
}
