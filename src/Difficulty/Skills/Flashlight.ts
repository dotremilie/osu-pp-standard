import { DifficultyHitObject, StrainSkill } from 'osu-classes';
import { StandardAutopilot, StandardFlashlight, StandardHidden, StandardModCombination, StandardRelax, StandardTouchDevice } from '../../Mods';
import { FlashlightEvaluator } from '../Evaluators';
import { StandardDifficultyHitObject } from '../Preprocessing';

/**
 * Represents the skill required to memorise and hit every object in a map with the Flashlight mod enabled.
 */
export class Flashlight extends StrainSkill {
  private static readonly SKILL_MULTIPLIER = 0.058;
  private static readonly STRAIN_DECAY_BASE = 0.15;

  private _currentStrain = 0;

  private readonly _hasHiddenMod: boolean;
  private readonly _totalObjects: number;

  constructor(mods: StandardModCombination, totalObjects: number) {
    super(mods);
    this._totalObjects = totalObjects;
    this._hasHiddenMod = mods.any(StandardHidden);
  }

  private _strainDecay(ms: number): number {
    return Math.pow(Flashlight.STRAIN_DECAY_BASE, ms / 1000);
  }

  protected _calculateInitialStrain(time: number, current: DifficultyHitObject): number {
    return this._currentStrain * this._strainDecay(time - (current.previous(0)?.startTime ?? 0));
  }

  protected _strainValueAt(current: DifficultyHitObject): number {
    if (!this._mods.any(StandardFlashlight)) return 0;

    this._currentStrain *= this._strainDecay(current.deltaTime);

    let flashlightValue = FlashlightEvaluator
      .evaluateDifficultyOf(current, this._hasHiddenMod);

    if (this._mods.any(StandardTouchDevice)) flashlightValue = Math.pow(flashlightValue, 0.9);
    if (this._mods.any(StandardRelax)) flashlightValue *= 0.7;
    if (this._mods.any(StandardAutopilot)) flashlightValue *= 0.4;

    const standardCurrent = current as StandardDifficultyHitObject;

    flashlightValue *= 0.985 + Math.pow(Math.max(0, standardCurrent.overallDifficulty), 2) / 4000;

    this._currentStrain += flashlightValue * Flashlight.SKILL_MULTIPLIER;

    return this._currentStrain;
  }

  get difficultyValue(): number {
    const strainSum = [...this.getCurrentStrainPeaks()].reduce((p, c) => p + c);

    return strainSum * (0.7 + 0.1 * Math.min(1, this._totalObjects / 200) +
      (this._totalObjects > 200 ? 0.2 * Math.min(1, (this._totalObjects - 200) / 200) : 0));
  }
}
