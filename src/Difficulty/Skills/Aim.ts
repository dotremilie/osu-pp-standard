// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject } from 'osu-classes';
import { StandardAutopilot, StandardModCombination, StandardRelax, StandardTouchDevice } from '../../Mods';
import { Slider } from '../../Objects';
import { AgilityEvaluator } from '../Evaluators/AgilityEvaluator';
import { FlowAimEvaluator } from '../Evaluators/FlowAimEvaluator';
import { SnapAimEvaluator } from '../Evaluators/SnapAimEvaluator';
import { StandardDifficultyHitObject } from '../Preprocessing';
import { StrainPeak, VariableLengthStrainSkill } from './VariableLengthStrainSkill';

/** osu!standard aim skill from the July 2026 rework. */
export class Aim extends VariableLengthStrainSkill {
  private _currentStrain = 0;
  private readonly _sliderStrains: number[] = [];
  private readonly _includeSliders: boolean;

  constructor(mods: StandardModCombination, includeSliders: boolean) {
    super(mods);
    this._includeSliders = includeSliders;
  }

  protected _calculateInitialStrain(time: number, current: DifficultyHitObject): number {
    return this._currentStrain * this._decay(time - (current.previous(0)?.startTime ?? 0));
  }

  protected _strainValueAt(current: DifficultyHitObject): number {
    if (this._mods.any(StandardAutopilot)) return 0;

    const standardCurrent = current as StandardDifficultyHitObject;
    const decay = this._decay(standardCurrent.adjustedDeltaTime);

    this._currentStrain *= decay;
    this._currentStrain += this._adjustedDifficulty(standardCurrent) * (1 - decay);

    if (standardCurrent.baseObject instanceof Slider) this._sliderStrains.push(this._currentStrain);

    return this._currentStrain;
  }

  private _adjustedDifficulty(current: StandardDifficultyHitObject): number {
    const snap = SnapAimEvaluator.evaluateDifficultyOf(current, this._includeSliders) * 70.9;
    const agility = AgilityEvaluator.evaluateDifficultyOf(current) * 2.35;
    let flow = FlowAimEvaluator.evaluateDifficultyOf(current, this._includeSliders) * 242;
    let combinedSnap = Math.pow(Math.pow(snap, 1.2) + Math.pow(agility, 1.2), 1 / 1.2);
    const ratio = flow / combinedSnap;
    const snapProbability = ratio === 0 ? 0 : Number.isNaN(ratio)
      ? 1 : 1 / (1 + Math.exp(-7.27 * Math.log(ratio)));

    if (this._mods.any(StandardTouchDevice)) {
      combinedSnap = Math.pow(Math.pow(Math.pow(snap, 0.89), 1.2) + Math.pow(agility, 1.2), 1 / 1.2);
    }

    if (this._mods.any(StandardRelax)) {
      combinedSnap *= 0.75;
      flow *= 0.6;
    }

    const total = (combinedSnap * snapProbability + flow * (1 - snapProbability)) * 1.12;

    return total * (0.985 + Math.pow(Math.max(0, current.overallDifficulty), 2) / 4000);
  }

  private _decay(ms: number): number {
    return Math.pow(0.2, ms / 1000);
  }

  getDifficultSliders(): number {
    if (this._sliderStrains.length === 0) return 0;

    const maxStrain = Math.max(...this._sliderStrains);
    if (maxStrain === 0) return 0;

    return this._sliderStrains.reduce((sum, strain) => {
      return sum + 1 / (1 + Math.exp(-(strain / maxStrain * 12 - 6)));
    }, 0);
  }

  countTopWeightedSliders(difficultyValue: number): number {
    if (this._sliderStrains.length === 0) return 0;

    const consistentTopStrain = difficultyValue * (1 - this._decayWeight);
    if (consistentTopStrain === 0) return 0;

    return this._sliderStrains.reduce((sum, strain) => {
      return sum + 1.1 / (1 + Math.exp(10 * (0.88 - strain / consistentTopStrain)));
    }, 0);
  }

  get difficultyValue(): number {
    let difficulty = 0;
    let time = 0;

    for (const strain of this._reducedStrainPeaks()) {
      const endTime = time + strain.sectionLength / this._maxSectionLength;
      const weight = Math.pow(this._decayWeight, time) - Math.pow(this._decayWeight, endTime);

      difficulty += strain.value * weight;
      time = endTime;
    }

    return difficulty / (1 - this._decayWeight);
  }

  private _reducedStrainPeaks(): StrainPeak[] {
    const strains = this.getCurrentStrainPeaks().filter((peak) => peak.value > 0);
    const chunkSize = 20;
    let time = 0;
    let skipCount = 0;

    while (strains.length > skipCount && time < 4000) {
      const strain = strains[skipCount];

      for (let addedTime = 0; addedTime < strain.sectionLength; addedTime += chunkSize) {
        const scale = Math.log10(1 + 9 * Math.min(1, (time + addedTime) / 4000));

        strains.push({
          value: strain.value * (0.727 + (1 - 0.727) * scale),
          sectionLength: Math.min(chunkSize, strain.sectionLength - addedTime),
        });
      }

      time += strain.sectionLength;
      skipCount++;
    }

    return strains.slice(skipCount).sort((a, b) => b.value - a.value);
  }
}
