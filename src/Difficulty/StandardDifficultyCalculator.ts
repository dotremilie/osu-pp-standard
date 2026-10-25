import {
  DifficultyCalculator,
  DifficultyRange,
  HitResult,
  IBeatmap,
  IMod,
  Skill,
} from 'osu-classes';

import {
  StandardDoubleTime,
  StandardEasy,
  StandardFlashlight,
  StandardHalfTime,
  StandardHardRock,
  StandardHidden,
  StandardModCombination,
  StandardTouchDevice,
} from '../Mods';

import { Aim, Flashlight, Reading, Speed } from './Skills';
import { StandardDifficultyAttributes } from './Attributes';
import { StandardDifficultyHitObject } from './Preprocessing';
import { Circle, Slider, Spinner } from '../Objects';
import { StandardHitWindows } from '../Scoring';
import { cognitionValue, norm } from './PerformanceMath';
import { calculateLegacyScoreAttributes } from './LegacyScoreUtils';

export class StandardDifficultyCalculator extends DifficultyCalculator<StandardDifficultyAttributes> {
  private readonly _DIFFICULTY_MULTIPLIER = 0.0675;

  protected _createDifficultyAttributes(
    beatmap: IBeatmap,
    mods: StandardModCombination,
    skills: Skill[],
    clockRate: number,
  ): StandardDifficultyAttributes {
    if (beatmap.hitObjects.length === 0) {
      return new StandardDifficultyAttributes(mods, 0);
    }

    const aim = skills[0] as Aim;
    const aimWithoutSliders = skills[1] as Aim;
    const speed = skills[2] as Speed;
    const reading = skills[3] as Reading;
    const aimValue = aim.difficultyValue;
    const aimWithoutSlidersValue = aimWithoutSliders.difficultyValue;
    const speedValue = speed.difficultyValue;
    const readingValue = reading.difficultyValue;
    const aimRating = Math.pow(aimValue, 0.63) * 0.02275;
    const aimRatingNoSliders = Math.pow(aimWithoutSlidersValue, 0.63) * 0.02275;
    const speedRating = Math.sqrt(speedValue) * this._DIFFICULTY_MULTIPLIER;
    const readingRating = Math.sqrt(readingValue) * this._DIFFICULTY_MULTIPLIER;
    const flashlightRating = mods.any(StandardFlashlight)
      ? Math.sqrt(skills[4].difficultyValue) * this._DIFFICULTY_MULTIPLIER : 0;
    const speedNoteCount = speed.relevantObjectCount();

    const sliderFactor = aimRating > 0 ? aimRatingNoSliders / aimRating : 1;

    const baseAimPerformance = 4 * Math.pow(aimRating, 3);
    const baseSpeedPerformance = 4 * Math.pow(speedRating, 3);
    const baseReadingPerformance = 4 * Math.pow(readingRating, 3);
    const baseFlashlightPerformance = 25 * Math.pow(flashlightRating, 2);
    const cognitionPerformance = cognitionValue(baseReadingPerformance, baseFlashlightPerformance);
    const basePerformance = norm(1.1, baseAimPerformance, baseSpeedPerformance, cognitionPerformance);
    const starRating = Math.cbrt(basePerformance * 1.12);

    const approachRate = beatmap.difficulty.approachRate;

    const preempt = DifficultyRange.map(approachRate, 1800, 1200, 450) / clockRate;

    const circles = beatmap.hitObjects.filter((h) => h instanceof Circle) as Circle[];
    const sliders = beatmap.hitObjects.filter((h) => h instanceof Slider) as Slider[];
    const spinners = beatmap.hitObjects.filter((h) => h instanceof Spinner) as Spinner[];

    const nested = sliders.reduce((sum, slider) => sum + slider.nestedHitObjects.length, 0);

    const hitWindows = new StandardHitWindows();

    hitWindows.setDifficulty(beatmap.difficulty.overallDifficulty);

    const hitWindowGreat = hitWindows.windowFor(HitResult.Great) / clockRate;
    const hitWindowOk = hitWindows.windowFor(HitResult.Ok) / clockRate;
    const hitWindowMeh = hitWindows.windowFor(HitResult.Meh) / clockRate;
    const legacyScore = calculateLegacyScoreAttributes(beatmap);

    const attributes = new StandardDifficultyAttributes(mods, starRating);

    attributes.aimDifficulty = aimRating;
    attributes.aimDifficultSliderCount = aim.getDifficultSliders();
    attributes.aimDifficultStrainCount = aim.countTopWeightedStrains(aimValue);
    attributes.speedDifficulty = speedRating;
    attributes.speedDifficultStrainCount = speed.countTopWeightedObjectDifficulties(speedValue);
    attributes.readingDifficulty = readingRating;
    attributes.readingDifficultNoteCount = reading.countTopWeightedObjectDifficulties(readingValue);
    attributes.speedNoteCount = speedNoteCount;
    attributes.flashlightDifficulty = flashlightRating;
    attributes.sliderFactor = sliderFactor;

    const aimWithoutSlidersTopWeightedSliders = aimWithoutSliders.countTopWeightedSliders(aimWithoutSlidersValue);
    const aimWithoutSlidersStrains = aimWithoutSliders.countTopWeightedStrains(aimWithoutSlidersValue);
    const speedTopWeightedSliders = speed.countTopWeightedSliders(speedValue);

    attributes.aimTopWeightedSliderFactor = aimWithoutSlidersTopWeightedSliders /
      Math.max(1, aimWithoutSlidersStrains - aimWithoutSlidersTopWeightedSliders);

    attributes.speedTopWeightedSliderFactor = speedTopWeightedSliders /
      Math.max(1, attributes.speedDifficultStrainCount - speedTopWeightedSliders);

    attributes.hitCircleCount = circles.length;
    attributes.sliderCount = sliders.length;
    attributes.spinnerCount = spinners.length;
    attributes.nestedScorePerObject = legacyScore.nestedScorePerObject;
    attributes.legacyScoreBaseMultiplier = legacyScore.legacyScoreBaseMultiplier;
    attributes.maximumLegacyComboScore = legacyScore.maximumLegacyComboScore;
    attributes.maxCombo = circles.length + spinners.length + nested;
    attributes.drainRate = beatmap.difficulty.drainRate;
    attributes.overallDifficulty = (79.5 - hitWindowGreat) / 6;
    attributes.greatHitWindow = hitWindowGreat;
    attributes.okHitWindow = hitWindowOk;
    attributes.mehHitWindow = hitWindowMeh;
    attributes.approachRate = preempt > 1200
      ? (1800 - preempt) / 120
      : (1200 - preempt) / 150 + 5;

    return attributes;
  }

  protected _createDifficultyHitObjects(beatmap: IBeatmap, clockRate: number): StandardDifficultyHitObject[] {
    const difficultyObjects: StandardDifficultyHitObject[] = [];

    /**
     * The first jump is formed by the first two hitobjects of the map.
     * If the map has less than two hit objects, the enumerator will not return anything.
     */
    for (let i = 1; i < beatmap.hitObjects.length; ++i) {
      const last = beatmap.hitObjects[i - 1];
      const current = beatmap.hitObjects[i];

      const object = new StandardDifficultyHitObject(
        current,
        last,
        clockRate,
        difficultyObjects,
        difficultyObjects.length,
      );

      difficultyObjects.push(object);
    }

    return difficultyObjects;
  }

  protected _createSkills(beatmap: IBeatmap, mods: StandardModCombination): Skill[] {
    return [
      new Aim(mods, true),
      new Aim(mods, false),
      new Speed(mods),
      new Reading(mods),
      new Flashlight(mods, beatmap.hitObjects.length),
    ];
  }

  get difficultyMods(): IMod[] {
    return [
      new StandardDoubleTime(),
      new StandardHalfTime(),
      new StandardEasy(),
      new StandardHardRock(),
      new StandardTouchDevice(),
      new StandardHidden(),
      new StandardFlashlight(),
    ];
  }
}
