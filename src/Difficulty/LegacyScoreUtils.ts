// Stable score estimation adapted from ppy/osu. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { IBeatmap } from 'osu-classes';
import { Circle, Slider, SliderTick, Spinner } from '../Objects';

export interface LegacyScoreAttributes {
  nestedScorePerObject: number;
  legacyScoreBaseMultiplier: number;
  maximumLegacyComboScore: number;
}

function roundToEven(value: number): number {
  const integer = Math.floor(value);
  const fraction = value - integer;

  return fraction === 0.5 ? integer + (integer % 2 === 0 ? 0 : 1) : Math.round(value);
}

function spinnerHalfSpins(spinner: Spinner): {
  fullSpins: number,
  bonusSpins: number,
} {
  const duration = spinner.duration / 1000;
  const halfSpins = Math.trunc(duration * 477 / 60 * 2);
  const beforeBonus = Math.trunc(duration * 3) + 3;
  const fullSpins = Math.trunc(halfSpins / 2);
  const bonusSpins = Math.max(0, Math.trunc((halfSpins - beforeBonus) / 2) - Math.trunc(fullSpins / 2));

  return {
    fullSpins,
    bonusSpins,
  };
}

function baseMultiplier(beatmap: IBeatmap): number {
  const objects = beatmap.hitObjects;

  if (objects.length === 0) return 0;

  const breaks = beatmap.events.breaks.reduce((sum, event) => sum + roundToEven(event.endTime) - roundToEven(event.startTime), 0);
  const drainLength = Math.trunc((roundToEven(objects[objects.length - 1].startTime) -
    roundToEven(objects[0].startTime) - breaks) / 1000);
  const ratio = drainLength === 0 ? 16 : Math.max(0, Math.min(objects.length / drainLength * 8, 16));
  const difficulty = beatmap.difficulty;

  return roundToEven((difficulty.drainRate + difficulty.overallDifficulty +
    difficulty.circleSize + ratio) / 38 * 5);
}

export function calculateLegacyScoreAttributes(beatmap: IBeatmap): LegacyScoreAttributes {
  const multiplier = baseMultiplier(beatmap.base ?? beatmap);
  let nestedScore = 0;
  let combo = 0;
  let comboScore = 0;

  const scoreMainObject = (): void => {
    comboScore += Math.trunc(Math.max(0, combo - 1) * 12 * multiplier);
    combo++;
  };

  for (const object of beatmap.hitObjects) {
    if (object instanceof Slider) {
      nestedScore += (2 + object.repeats) * 30 +
        object.nestedHitObjects.filter((nested) => nested instanceof SliderTick).length * 10;

      combo += object.nestedHitObjects.length;
      comboScore += Math.trunc(Math.max(0, combo - 1) * 12 * multiplier);
    }
    else if (object instanceof Spinner) {
      const { fullSpins, bonusSpins } = spinnerHalfSpins(object);

      nestedScore += fullSpins * 100 + bonusSpins * 1000;
      scoreMainObject();
    }
    else if (object instanceof Circle) {
      scoreMainObject();
    }
  }

  return {
    nestedScorePerObject: beatmap.hitObjects.length > 0 ? nestedScore / beatmap.hitObjects.length : 0,
    legacyScoreBaseMultiplier: multiplier,
    maximumLegacyComboScore: comboScore,
  };
}
