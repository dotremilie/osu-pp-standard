// July 2026 osu!standard performance adapted from ppy/osu. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyAttributes, HitResult, IRuleset, IScoreInfo, PerformanceCalculator } from 'osu-classes';
import { StandardAutopilot, StandardClassic, StandardFlashlight, StandardModCombination, StandardNoFail, StandardRelax, StandardSpunOut } from '../Mods';
import { StandardHitResult } from '../Scoring';
import { StandardDifficultyAttributes, StandardPerformanceAttributes } from './Attributes';
import { reverseLerp, smoothstep } from './Evaluators/JulyAimMath';
import { cognitionValue, erf, erfInv, norm } from './JulyPerformanceMath';

/** July 2026 performance calculation for supported osu!standard score settings. */
export class StandardPerformanceCalculator extends PerformanceCalculator {
  static readonly PERFORMANCE_BASE_MULTIPLIER = 1.12;

  attributes?: StandardDifficultyAttributes;

  private _mods = new StandardModCombination();
  private _scoreMaxCombo = 0;
  private _countGreat = 0;
  private _countOk = 0;
  private _countMeh = 0;
  private _countMiss = 0;
  private _countSliderTickMiss = 0;
  private _countSliderEndsDropped = 0;
  private _accuracy = 1;
  private _effectiveMissCount = 0;
  private _speedDeviation: number | null = null;
  private _aimEstimatedSliderBreaks = 0;
  private _speedEstimatedSliderBreaks = 0;

  constructor(ruleset: IRuleset, attributes?: DifficultyAttributes, score?: IScoreInfo) {
    super(ruleset, attributes, score);
    this._addParams(attributes, score);
  }

  calculateAttributes(attributes?: StandardDifficultyAttributes, score?: IScoreInfo): StandardPerformanceAttributes {
    this._addParams(attributes, score);

    if (!this.attributes) return new StandardPerformanceAttributes(this._mods, 0);

    const difficulty = this.attributes;
    const comboMisses = this._calculateComboBasedEstimatedMissCount(difficulty);

    this._effectiveMissCount = Math.min(this._totalHits, Math.max(this._countMiss, comboMisses));
    this._speedDeviation = this._calculateSpeedDeviation(difficulty);
    this._aimEstimatedSliderBreaks = this._effectiveMissCount > 0
      ? this._calculateEstimatedSliderBreaks(difficulty.aimTopWeightedSliderFactor, difficulty) : 0;

    this._speedEstimatedSliderBreaks = this._effectiveMissCount > 0
      ? this._calculateEstimatedSliderBreaks(difficulty.speedTopWeightedSliderFactor, difficulty) : 0;

    let multiplier = StandardPerformanceCalculator.PERFORMANCE_BASE_MULTIPLIER;

    if (this._mods.any(StandardNoFail)) multiplier *= Math.max(0.9, 1 - 0.02 * this._effectiveMissCount);

    if (this._mods.any(StandardSpunOut) && this._totalHits > 0) {
      multiplier *= 1 - Math.pow(difficulty.spinnerCount / this._totalHits, 0.85);
    }

    if (this._mods.any(StandardRelax)) {
      const od = difficulty.overallDifficulty;
      const okMultiplier = 0.75 * Math.max(0, od > 0 ? 1 - od / 13.33 : 1);
      const mehMultiplier = Math.max(0, od > 0 ? 1 - Math.pow(od / 13.33, 5) : 1);

      this._effectiveMissCount = Math.min(this._totalHits,
        this._effectiveMissCount + this._countOk * okMultiplier + this._countMeh * mehMultiplier);
    }

    const aim = this._computeAimValue(difficulty);
    const speed = this._computeSpeedValue(difficulty);
    const accuracy = this._computeAccuracyValue(difficulty);
    const reading = this._computeReadingValue(difficulty);
    const flashlight = this._computeFlashlightValue(difficulty);
    const total = norm(1.1, aim, speed, accuracy, cognitionValue(reading, flashlight)) * multiplier;

    const performance = new StandardPerformanceAttributes(this._mods, total);

    performance.aimPerformance = aim;
    performance.speedPerformance = speed;
    performance.accuracyPerformance = accuracy;
    performance.readingPerformance = reading;
    performance.flashlightPerformance = flashlight;
    performance.effectiveMissCount = this._effectiveMissCount;
    performance.speedDeviation = this._speedDeviation;

    return performance;
  }

  private _computeAimValue(attributes: StandardDifficultyAttributes): number {
    if (this._mods.any(StandardAutopilot)) return 0;

    let aimDifficulty = attributes.aimDifficulty;

    if (attributes.sliderCount > 0 && attributes.aimDifficultSliderCount > 0) {
      const improperlyFollowed = Math.max(0, Math.min(attributes.aimDifficultSliderCount,
        this._usingClassicSliderAccuracy
          ? Math.min(this._totalImperfectHits, attributes.maxCombo - this._scoreMaxCombo)
          : this._countSliderEndsDropped + this._countSliderTickMiss));
      const sliderNerf = (1 - attributes.sliderFactor) *
        Math.pow(1 - improperlyFollowed / attributes.aimDifficultSliderCount, 3) + attributes.sliderFactor;

      aimDifficulty *= sliderNerf;
    }

    let value = 4 * Math.pow(aimDifficulty, 3);
    const lengthBonus = 0.95 + 0.35 * Math.min(1, this._totalHits / 2000) +
      (this._totalHits > 2000 ? Math.log10(this._totalHits / 2000) * 0.5 : 0);

    value *= lengthBonus;

    if (this._effectiveMissCount > 0) {
      const relevantMisses = Math.min(this._effectiveMissCount + this._aimEstimatedSliderBreaks,
        this._totalImperfectHits + this._countSliderTickMiss);

      value *= this._missPenalty(relevantMisses, attributes.aimDifficultStrainCount);
    }

    return value * this._accuracy;
  }

  private _computeSpeedValue(attributes: StandardDifficultyAttributes): number {
    if (this._mods.any(StandardRelax) || this._speedDeviation === null) return 0;

    let value = 4 * Math.pow(attributes.speedDifficulty, 3);

    if (this._effectiveMissCount > 0) {
      const relevantMisses = Math.min(this._effectiveMissCount + this._speedEstimatedSliderBreaks,
        this._totalImperfectHits + this._countSliderTickMiss);

      value *= this._missPenalty(relevantMisses, attributes.speedDifficultStrainCount);
    }

    value *= this._speedHighDeviationNerf(attributes);

    const effectiveHitWindow = 20 * Math.pow(4 / attributes.speedDifficulty, 0.35);
    const effectiveAccuracy = erf(effectiveHitWindow / this._speedDeviation);

    return value * Math.pow(effectiveAccuracy, 2);
  }

  private _computeAccuracyValue(attributes: StandardDifficultyAttributes): number {
    if (this._mods.any(StandardRelax)) return 0;

    const accuracyObjects = attributes.hitCircleCount +
      (this._usingClassicSliderAccuracy ? 0 : attributes.sliderCount);
    const betterAccuracy = accuracyObjects > 0 ? Math.max(0,
      ((this._countGreat - Math.max(this._totalHits - accuracyObjects, 0)) * 6 +
        this._countOk * 2 + this._countMeh) / (accuracyObjects * 6)) : 0;

    let value = Math.pow(1.52163, attributes.overallDifficulty) *
      Math.pow(betterAccuracy, 24) * 2.83;

    value *= accuracyObjects < 1000 ? Math.pow(accuracyObjects / 1000, 0.3)
      : Math.pow(accuracyObjects / 1000, 0.1);

    return value;
  }

  private _computeFlashlightValue(attributes: StandardDifficultyAttributes): number {
    if (!this._mods.any(StandardFlashlight)) return 0;

    let value = 25 * Math.pow(attributes.flashlightDifficulty, 2);

    if (this._effectiveMissCount > 0) {
      value *= 0.97 * Math.pow(1 - Math.pow(this._effectiveMissCount / this._totalHits, 0.775),
        Math.pow(this._effectiveMissCount, 0.875));
    }

    value *= this._comboScalingFactor(attributes);

    return value * (0.5 + this._accuracy / 2);
  }

  private _computeReadingValue(attributes: StandardDifficultyAttributes): number {
    let value = 4 * Math.pow(attributes.readingDifficulty, 3);

    if (this._effectiveMissCount > 0) {
      value *= this._missPenalty(this._effectiveMissCount + this._aimEstimatedSliderBreaks,
        attributes.readingDifficultNoteCount);
    }

    return value * Math.pow(this._accuracy, 3);
  }

  private _calculateComboBasedEstimatedMissCount(attributes: StandardDifficultyAttributes): number {
    if (attributes.sliderCount <= 0) return this._countMiss;

    let misses = this._countMiss;

    if (this._usingClassicSliderAccuracy) {
      const likelyTailPortion = 0.04 + 0.06 *
        Math.pow(Math.min(attributes.aimTopWeightedSliderFactor, 1), 2);
      const fullComboThreshold = attributes.maxCombo -
        Math.min(4 + likelyTailPortion * attributes.sliderCount, attributes.sliderCount);

      if (this._scoreMaxCombo < fullComboThreshold) {
        misses = fullComboThreshold / Math.max(1, this._scoreMaxCombo);
      }

      misses = Math.min(misses, this._totalImperfectHits);

      const possibleBreaks = Math.min(attributes.sliderCount,
        Math.trunc((attributes.maxCombo - this._scoreMaxCombo) / 2));

      return misses - this._countMiss > possibleBreaks ? this._countMiss + possibleBreaks : misses;
    }

    const fullComboThreshold = attributes.maxCombo - this._countSliderEndsDropped;

    if (this._scoreMaxCombo < fullComboThreshold) misses = fullComboThreshold / Math.max(1, this._scoreMaxCombo);

    return Math.min(misses, this._countSliderTickMiss + this._countMiss);
  }

  private _calculateEstimatedSliderBreaks(factor: number, attributes: StandardDifficultyAttributes): number {
    const nonMissMistakes = this._countOk + this._countMeh;
    if (!this._usingClassicSliderAccuracy || nonMissMistakes === 0) return 0;

    const missedComboPercent = 1 - this._scoreMaxCombo / attributes.maxCombo;
    let estimated = Math.min(nonMissMistakes, this._effectiveMissCount * factor);
    const mistakeAdjustment = (nonMissMistakes - estimated + 4.5) / (nonMissMistakes + 4);

    estimated *= smoothstep(this._effectiveMissCount, 1, 2);

    return estimated * mistakeAdjustment / (1 + Math.exp(15 * (0.33 - missedComboPercent)));
  }

  private _calculateSpeedDeviation(attributes: StandardDifficultyAttributes): number | null {
    if (this._totalSuccessfulHits === 0) return null;

    const speedNotes = attributes.speedNoteCount + (this._totalHits - attributes.speedNoteCount) * 0.1;
    const misses = Math.min(this._countMiss, speedNotes);
    const mehs = Math.min(this._countMeh, speedNotes - misses);
    const oks = Math.min(this._countOk, speedNotes - misses - mehs);
    const greats = Math.max(0, speedNotes - misses - mehs - oks);

    return this._calculateDeviation(greats, oks, mehs, attributes);
  }

  private _calculateDeviation(greats: number, oks: number, mehs: number,
    attributes: StandardDifficultyAttributes): number | null {
    if (greats + oks + mehs <= 0) return null;

    const n = Math.max(1, greats + oks);
    const p = greats / n;
    const z = 2.32634787404;
    const lowerBound = Math.min(p,
      (n * p + z * z / 2) / (n + z * z) - z / (n + z * z) *
      Math.sqrt(n * p * (1 - p) + z * z / 4));
    let deviation: number;

    if (lowerBound > 0.01) {
      deviation = attributes.greatHitWindow / (Math.SQRT2 * erfInv(lowerBound));

      const okTailAmount = Math.sqrt(2 / Math.PI) * attributes.okHitWindow *
        Math.exp(-0.5 * Math.pow(attributes.okHitWindow / deviation, 2)) /
        (deviation * erf(attributes.okHitWindow / (Math.SQRT2 * deviation)));

      deviation *= Math.sqrt(1 - okTailAmount);
    }
    else {
      deviation = attributes.okHitWindow / Math.sqrt(3);
    }

    const mehVariance = (Math.pow(attributes.mehHitWindow, 2) +
      attributes.okHitWindow * attributes.mehHitWindow +
      Math.pow(attributes.okHitWindow, 2)) / 3;

    return Math.sqrt(((greats + oks) * Math.pow(deviation, 2) + mehs * mehVariance) /
      (greats + oks + mehs));
  }

  private _speedHighDeviationNerf(attributes: StandardDifficultyAttributes): number {
    if (this._speedDeviation === null) return 0;

    const speedValue = 4 * Math.pow(attributes.speedDifficulty, 3);
    const cutoff = 100 + 220 * Math.pow(22 / this._speedDeviation, 6.5);

    if (speedValue <= cutoff) return 1;

    const scale = 50;
    let adjusted = scale * (Math.log((speedValue - cutoff) / scale + 1) + cutoff / scale);
    const interpolation = 1 - reverseLerp(this._speedDeviation, 22, 27);

    adjusted += (speedValue - adjusted) * interpolation;

    return adjusted / speedValue;
  }

  private _missPenalty(missCount: number, difficultStrainCount: number): number {
    return 0.93 / (missCount / (4 * Math.log(Math.max(1, difficultStrainCount))) + 1);
  }

  private _comboScalingFactor(attributes: StandardDifficultyAttributes): number {
    return attributes.maxCombo <= 0 ? 1
      : Math.min(Math.pow(this._scoreMaxCombo, 0.8) / Math.pow(attributes.maxCombo, 0.8), 1);
  }

  private _addParams(attributes?: DifficultyAttributes, score?: IScoreInfo): void {
    if (attributes) {
      this.attributes = attributes as StandardDifficultyAttributes;
      this._mods = this.attributes.mods as StandardModCombination;
    }

    if (!score) return;

    this._mods = score.mods as StandardModCombination ?? this._mods;
    this._scoreMaxCombo = score.maxCombo ?? this._scoreMaxCombo;
    this._countGreat = score.statistics.get(HitResult.Great) ?? 0;
    this._countOk = score.statistics.get(HitResult.Ok) ?? 0;
    this._countMeh = score.statistics.get(HitResult.Meh) ?? 0;
    this._countMiss = score.statistics.get(HitResult.Miss) ?? 0;
    this._countSliderTickMiss = score.statistics.get(HitResult.LargeTickMiss) ?? 0;

    const tailHits = score.statistics.get(StandardHitResult.SliderTailHit);

    this._countSliderEndsDropped = tailHits === undefined ? 0
      : Math.max(0, (this.attributes?.sliderCount ?? 0) - tailHits);

    this._accuracy = score.accuracy ?? this._accuracy;
  }

  private get _totalHits(): number {
    return this._countGreat + this._countOk + this._countMeh + this._countMiss;
  }

  private get _totalSuccessfulHits(): number {
    return this._countGreat + this._countOk + this._countMeh;
  }

  private get _totalImperfectHits(): number {
    return this._countOk + this._countMeh + this._countMiss;
  }

  private get _usingClassicSliderAccuracy(): boolean {
    return this._mods.all.some((mod) => mod instanceof StandardClassic && mod.noSliderHeadAccuracy);
  }
}
