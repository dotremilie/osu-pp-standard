// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject, ModCombination } from 'osu-classes';
import { Skill } from './Skill';

export interface StrainPeak {
  readonly value: number;
  readonly sectionLength: number;
}

/** One peak per changing strain, with sections of at most 400ms by default. */
export abstract class VariableLengthStrainSkill extends Skill {
  protected readonly _decayWeight: number;
  protected readonly _maxSectionLength: number;

  private _currentSectionPeak = 0;
  private _currentSectionBegin = 0;
  private _currentSectionEnd = 0;
  private readonly _maxStoredLength: number;
  private readonly _strainPeaks: StrainPeak[] = [];
  private readonly _queuedStrains: {
    value: number,
    startTime: number,
  }[] = [];
  private _totalLength = 0;
  private _finalPeak: StrainPeak | null = null;

  constructor(mods: ModCombination, decayWeight = 0.9, maxSectionLength = 400) {
    super(mods);
    this._decayWeight = decayWeight;
    this._maxSectionLength = maxSectionLength;
    this._maxStoredLength = 11 / (1 - decayWeight);
  }

  protected abstract _strainValueAt(current: DifficultyHitObject): number;
  protected abstract _calculateInitialStrain(time: number, current: DifficultyHitObject): number;

  protected _processObject(current: DifficultyHitObject): number {
    if (this._objectDifficulties.length === 0) {
      this._currentSectionBegin = current.startTime;
      this._currentSectionEnd = this._currentSectionBegin + this._maxSectionLength;
      this._currentSectionPeak = this._strainValueAt(current);

      return this._currentSectionPeak;
    }

    this._backfillPeaks(current);

    const currentStrain = this._strainValueAt(current);

    if (currentStrain > this._currentSectionPeak) {
      this._queuedStrains.length = 0;
      this._saveCurrentPeak(current.startTime - this._currentSectionBegin);
      this._currentSectionBegin = current.startTime;
      this._currentSectionEnd = this._currentSectionBegin + this._maxSectionLength;
      this._currentSectionPeak = currentStrain;
    }
    else {
      while (this._queuedStrains.length > 0 &&
        this._queuedStrains[this._queuedStrains.length - 1].value < currentStrain) {
        this._queuedStrains.pop();
      }

      this._queuedStrains.push({
        value: currentStrain,
        startTime: current.startTime,
      });
    }

    return currentStrain;
  }

  getCurrentStrainPeaks(): readonly StrainPeak[] {
    if (this._finalPeak === null) {
      this._finalPeak = this._makePeak(this._currentSectionPeak,
        this._currentSectionEnd - this._currentSectionBegin);

      this._insertPeak(this._finalPeak);
    }

    return this._strainPeaks;
  }

  countTopWeightedStrains(difficultyValue: number): number {
    if (this._objectDifficulties.length === 0) return 0;

    const consistentTopStrain = difficultyValue * (1 - this._decayWeight);
    if (consistentTopStrain === 0) return this._objectDifficulties.length;

    return this._objectDifficulties.reduce((sum, strain) => {
      return sum + 1.1 / (1 + Math.exp(-10 * (strain / consistentTopStrain - 0.88)));
    }, 0);
  }

  private _backfillPeaks(current: DifficultyHitObject): void {
    while (current.startTime > this._currentSectionEnd) {
      this._saveCurrentPeak(this._currentSectionEnd - this._currentSectionBegin);
      this._currentSectionBegin = this._currentSectionEnd;

      if (this._queuedStrains.length > 0) {
        const queued = this._queuedStrains.shift()!;

        this._currentSectionEnd = queued.startTime + this._maxSectionLength;
        this._currentSectionPeak = Math.max(this._calculateInitialStrain(this._currentSectionBegin, current), queued.value);
      }
      else {
        this._currentSectionEnd = this._currentSectionBegin + this._maxSectionLength;
        this._currentSectionPeak = this._calculateInitialStrain(this._currentSectionBegin, current);
      }
    }
  }

  private _saveCurrentPeak(sectionLength: number): void {
    if (this._finalPeak !== null) {
      this._strainPeaks.splice(this._strainPeaks.indexOf(this._finalPeak), 1);
      this._finalPeak = null;
    }

    const peak = this._makePeak(this._currentSectionPeak, sectionLength);

    this._insertPeak(peak);
    this._totalLength += sectionLength;

    while (this._totalLength > this._maxStoredLength * this._maxSectionLength) {
      this._totalLength -= this._strainPeaks[this._strainPeaks.length - 1].sectionLength;
      this._strainPeaks.pop();
    }
  }

  private _insertPeak(peak: StrainPeak): void {
    const index = this._strainPeaks.findIndex((stored) => stored.value < peak.value);

    this._strainPeaks.splice(index < 0 ? this._strainPeaks.length : index, 0, peak);
  }

  private _makePeak(value: number, sectionLength: number): StrainPeak {
    const rounded = Math.round(sectionLength);
    const evenRounded = sectionLength - Math.floor(sectionLength) === 0.5 && rounded % 2 !== 0
      ? rounded - 1
      : rounded;

    return {
      value,
      sectionLength: evenRounded,
    };
  }
}
