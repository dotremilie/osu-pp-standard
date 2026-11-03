import fs from 'fs';
import path from 'path';
import { DifficultyHitObject, HitResult, Vector2 } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import { StandardBlinds, StandardClassic, StandardDaycore, StandardModCombination, StandardTraceable } from '../src/Mods';
import { Circle, Slider, Spinner } from '../src/Objects';
import { StandardRuleset } from '../src/StandardRuleset';
import { StandardHitWindows } from '../src/Scoring';
import { StandardDifficultyHitObject } from '../src/Difficulty/Preprocessing';
import { SpeedEvaluator } from '../src/Difficulty/Evaluators/SpeedEvaluator';
import { RhythmEvaluator } from '../src/Difficulty/Evaluators/RhythmEvaluator';
import { HarmonicSkill } from '../src/Difficulty/Skills/HarmonicSkill';
import { StandardStrainSkill } from '../src/Difficulty/Skills/StandardStrainSkill';
import { Speed } from '../src/Difficulty/Skills/Speed';

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

class TestStandardStrainSkill extends StandardStrainSkill {
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
  const skill = new TestStandardStrainSkill(new StandardModCombination());

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

test('standard hit windows use official floor minus half millisecond rounding', () => {
  const windows = new StandardHitWindows();

  windows.setDifficulty(8);

  expect(windows.windowFor(HitResult.Great)).toBe(31.5);
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
  const source = fs.readFileSync(path.resolve(__dirname, 'fixtures/very-fast-slider.osu'), 'utf8');
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

  expect(SpeedEvaluator.evaluateDifficultyOf(current)).toBeCloseTo(expected, 10);
});

test('July rhythm evaluator distinguishes repeated timing from changing islands', () => {
  const createDifficultyObjects = (times: number[]): StandardDifficultyHitObject[] => {
    const circles = times.map((startTime) => {
      const circle = new Circle();

      circle.startTime = startTime;
      circle.hitWindows.setDifficulty(5);

      return circle;
    });

    const objects: StandardDifficultyHitObject[] = [];

    for (let i = 1; i < circles.length; ++i) {
      objects.push(new StandardDifficultyHitObject(circles[i], circles[i - 1], 1, objects, i - 1));
    }

    return objects;
  };

  const even = createDifficultyObjects([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800]);
  const changing = createDifficultyObjects([1000, 1200, 1400, 1500, 1600, 1800, 2000, 2100, 2200]);

  expect(RhythmEvaluator.evaluateDifficultyOf(even[even.length - 1])).toBe(1);
  expect(RhythmEvaluator.evaluateDifficultyOf(changing[changing.length - 1])).toBeGreaterThan(1);
});

test('July Speed uses harmonic strain and Relax disables tapping difficulty', () => {
  const first = new Circle();

  first.startTime = 1000;

  const second = new Circle();

  second.startTime = 1100;
  second.hitWindows.setDifficulty(5);

  const difficultyObject = new StandardDifficultyHitObject(second, first, 1, [], 0);
  const speed = new Speed(new StandardModCombination());
  const relaxedSpeed = new Speed(new StandardModCombination('RX'));

  speed.process(difficultyObject);
  relaxedSpeed.process(difficultyObject);

  expect(speed.difficultyValue).toBeGreaterThan(0);
  expect(speed.relevantObjectCount()).toBeGreaterThan(0);
  expect(relaxedSpeed.difficultyValue).toBe(0);
});

test('Classic slider accuracy survives mod combination cloning', () => {
  const classic = new StandardModCombination('CL');

  expect(classic.acronyms).toEqual(['CL']);
  expect(classic.any(StandardClassic)).toBe(true);
  expect(classic.clone().any(StandardClassic)).toBe(true);
  expect(classic.equals(new StandardModCombination('NM'))).toBe(false);

  const classicMod = classic.all.find((mod) => mod instanceof StandardClassic) as StandardClassic;

  classicMod.noSliderHeadAccuracy = false;

  expect((classic.clone().all.find((mod) => mod instanceof StandardClassic) as StandardClassic)
    .noSliderHeadAccuracy).toBe(false);

  expect(classic.equals(new StandardModCombination('CL'))).toBe(false);
});

test('ScoreV2 survives acronym and bitwise mod combination cloning', () => {
  const scoreV2 = new StandardModCombination('CLSV2');

  expect(scoreV2.has('SV2')).toBe(true);
  expect(scoreV2.clone().has('SV2')).toBe(true);
  expect(scoreV2.equals(new StandardModCombination(scoreV2.bitwise))).toBe(false);
});

test('Blinds and Traceable keep their acronym markers when cloned', () => {
  for (const [acronym, Mod] of [
    ['BL', StandardBlinds],
    ['TC', StandardTraceable],
  ] as const) {
    const combination = new StandardModCombination(`DT${acronym}`);
    const clone = combination.clone();

    expect(combination.has(acronym)).toBe(true);
    expect(combination.any(Mod)).toBe(true);
    expect(clone.has('DT')).toBe(true);
    expect(clone.has(acronym)).toBe(true);
    expect(clone.equals(combination)).toBe(true);
    expect(combination.equals(new StandardModCombination('DT'))).toBe(false);
  }
});

test('Daycore keeps its rate mod when combined with Classic and cloned', () => {
  const combination = new StandardModCombination('DCCL');
  const cloned = combination.clone();

  expect(combination.any(StandardDaycore)).toBe(true);
  expect(cloned.has('DC')).toBe(true);
  expect(cloned.has('CL')).toBe(true);
  expect(cloned.equals(combination)).toBe(true);
  expect(combination.equals(new StandardModCombination('HTCL'))).toBe(false);
});
