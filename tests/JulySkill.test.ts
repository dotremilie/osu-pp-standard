import fs from 'fs';
import path from 'path';
import { DifficultyHitObject, Vector2 } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import { StandardModCombination } from '../src/Mods';
import { Circle, Slider, Spinner } from '../src/Objects';
import { StandardRuleset } from '../src/StandardRuleset';
import { StandardDifficultyHitObject } from '../src/Difficulty/Preprocessing';
import { JulySpeedEvaluator } from '../src/Difficulty/Evaluators/JulySpeedEvaluator';
import { HarmonicSkill } from '../src/Difficulty/Skills/HarmonicSkill';
import { VariableLengthStrainSkill } from '../src/Difficulty/Skills/VariableLengthStrainSkill';

function objectAt(startTime: number, value: number): DifficultyHitObject {
  return {
    startTime,
    value,
  } as unknown as DifficultyHitObject;
}

class TestHarmonicSkill extends HarmonicSkill {
  protected _objectDifficultyOf(current: DifficultyHitObject): number {
    return (current as DifficultyHitObject & { value: number, }).value;
  }
}

class TestVariableLengthStrainSkill extends VariableLengthStrainSkill {
  get difficultyValue(): number {
    return this.getCurrentStrainPeaks().reduce((sum, peak) => sum + peak.value, 0);
  }

  protected _strainValueAt(current: DifficultyHitObject): number {
    return (current as DifficultyHitObject & { value: number, }).value;
  }

  protected _calculateInitialStrain(): number {
    return 0;
  }
}

test('harmonic weights sort positive difficulties and stay stable across reads', () => {
  const skill = new TestHarmonicSkill(new StandardModCombination());

  [2, 0, 4].forEach((value, index) => skill.process(objectAt(index * 100, value)));

  const secondWeight = (1 + 1 / 2) / (Math.pow(1, 0.9) + 1 + 1 / 2);

  expect(skill.difficultyValue).toBeCloseTo(4 + 2 * secondWeight, 12);
  expect(skill.difficultyValue).toBeCloseTo(4 + 2 * secondWeight, 12);
  expect(skill.objectDifficulties).toEqual([2, 0, 4]);
  expect(skill.countTopWeightedObjectDifficulties(skill.difficultyValue)).toBeGreaterThan(0);
});

test('variable strain sections backfill queued strains and replace the live peak', () => {
  const skill = new TestVariableLengthStrainSkill(new StandardModCombination());

  skill.process(objectAt(1000, 10));
  skill.process(objectAt(1100, 5));
  skill.process(objectAt(1600, 2));

  expect(skill.getCurrentStrainPeaks()).toEqual([
    {
      value: 10,
      sectionLength: 400,
    },
    {
      value: 5,
      sectionLength: 100,
    },
    {
      value: 2,
      sectionLength: 400,
    },
    {
      value: 0,
      sectionLength: 100,
    },
  ]);

  skill.process(objectAt(1700, 3));

  expect(skill.getCurrentStrainPeaks()).toEqual([
    {
      value: 10,
      sectionLength: 400,
    },
    {
      value: 5,
      sectionLength: 100,
    },
    {
      value: 3,
      sectionLength: 400,
    },
    {
      value: 2,
      sectionLength: 100,
    },
    {
      value: 0,
      sectionLength: 100,
    },
  ]);

  expect(skill.objectDifficulties).toEqual([10, 5, 2, 3]);
});

test('July timing and jump fields account for clock rate and prior object end', () => {
  const first = new Circle();

  first.startTime = 1000;
  first.startPosition = new Vector2(100, 100);

  const second = new Circle();

  second.startTime = 1100;
  second.startPosition = new Vector2(164, 100);

  const third = new Circle();

  third.startTime = 1120;
  third.startPosition = new Vector2(164, 164);

  const objects: StandardDifficultyHitObject[] = [];
  const secondDifficulty = new StandardDifficultyHitObject(second, first, 2, objects, 0);

  objects.push(secondDifficulty);

  const thirdDifficulty = new StandardDifficultyHitObject(third, second, 2, objects, 1);

  objects.push(thirdDifficulty);

  const fourth = new Circle();

  fourth.startTime = 1320;
  fourth.startPosition = new Vector2(100, 164);

  const fourthDifficulty = new StandardDifficultyHitObject(fourth, third, 2, objects, 2);

  expect(secondDifficulty.adjustedDeltaTime).toBe(50);
  expect(secondDifficulty.lastObjectEndDeltaTime).toBe(50);
  expect(secondDifficulty.preempt).toBe(300);
  expect(secondDifficulty.jumpDistance).toBe(100);
  expect(thirdDifficulty.adjustedDeltaTime).toBe(25);
  expect(thirdDifficulty.lastObjectEndDeltaTime).toBe(25);
  expect(thirdDifficulty.angle).toBeNull();
  expect(fourthDifficulty.angle).toBeCloseTo(Math.PI / 2);
  expect(fourthDifficulty.normalisedVectorAngle).toBeCloseTo(0);
  expect(secondDifficulty.calculateDoubleTapFeasibility(thirdDifficulty)).toBe(0);
  expect(secondDifficulty.calculateDoubleTapFeasibility(null)).toBe(0);
});

test('July end delta uses the wrapped previous object duration', () => {
  const first = new Circle();

  first.startTime = 1000;

  const spinner = new Spinner();

  spinner.startTime = 1100;
  spinner.endTime = 1500;

  const third = new Circle();

  third.startTime = 1550;

  const objects: StandardDifficultyHitObject[] = [];
  const spinnerDifficulty = new StandardDifficultyHitObject(spinner, first, 1, objects, 0);

  objects.push(spinnerDifficulty);

  const thirdDifficulty = new StandardDifficultyHitObject(third, spinner, 1, objects, 1);

  expect(thirdDifficulty.deltaTime).toBe(450);
  expect(thirdDifficulty.lastObjectEndDeltaTime).toBe(50);
});

test('double tap feasibility rises for a stacked rhythm change', () => {
  const first = new Circle();

  first.startTime = 1000;

  const second = new Circle();

  second.startTime = 1025;
  second.hitWindows.setDifficulty(5);

  const third = new Circle();

  third.startTime = 1325;

  const objects: StandardDifficultyHitObject[] = [];
  const secondDifficulty = new StandardDifficultyHitObject(second, first, 1, objects, 0);

  objects.push(secondDifficulty);

  const thirdDifficulty = new StandardDifficultyHitObject(third, second, 1, objects, 1);

  expect(secondDifficulty.calculateDoubleTapFeasibility(thirdDifficulty)).toBeGreaterThan(0.8);
});

test('converted slider tail is at its end while difficulty tracks to legacy leniency', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'Files/July2026/very-fast-slider.osu'), 'utf8');
  const parsed = new BeatmapDecoder().decodeFromString(source, false);
  const beatmap = new StandardRuleset().applyToBeatmap(parsed);
  const slider = beatmap.hitObjects[0] as Slider;

  expect(slider).toBeInstanceOf(Slider);
  expect(slider.tail?.startTime).toBeCloseTo(slider.endTime);

  const previous = new Circle();

  previous.startTime = slider.startTime - 100;

  new StandardDifficultyHitObject(slider, previous, 1, [], 0);

  expect(slider.lazyTravelTime).toBeCloseTo(Math.max(slider.duration - 36, slider.duration / 2));
});

test('July speed evaluator applies the OD cap and high BPM bonus', () => {
  const first = new Circle();

  first.startTime = 1000;

  const second = new Circle();

  second.startTime = 1100;
  second.hitWindows.setDifficulty(5);

  const current = new StandardDifficultyHitObject(second, first, 1, [], 0);
  const strainTime = 100 / Math.min(1, Math.max(0.92, (100 / current.hitWindowGreat) / 0.93));
  const expected = 1000 / strainTime / (1 - Math.pow(0.3, 0.1));

  expect(JulySpeedEvaluator.evaluateDifficultyOf(current)).toBeCloseTo(expected, 10);
});
