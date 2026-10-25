import fs from 'fs';
import path from 'path';
import { HitResult, IScoreInfo, ScoreInfo } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import { ITestAttributes, IModdedAttributes } from './Attributes';
import {
  StandardRuleset,
  StandardDifficultyAttributes,
  StandardPerformanceAttributes,
  StandardBeatmap,
} from '../src';

const ruleset = new StandardRuleset();
const decoder = new BeatmapDecoder();

describe('Standard specific beatmaps', () => testRuleset('Standard'));

function testRuleset(rulesetName: string): void {
  const rulesetPath = path.resolve(__dirname, `./Files/${rulesetName}`);

  testBeatmaps(rulesetPath);
}

function testBeatmaps(rulesetPath: string): void {
  const beatmapsPath = path.resolve(rulesetPath, './Beatmaps');
  const beatmapFiles = fs.readdirSync(beatmapsPath);
  for (const beatmapFile of beatmapFiles) {
    const beatmapPath = path.resolve(beatmapsPath, beatmapFile);
    const beatmapId = beatmapFile.split('.')[0];

    const attributesPath = `${rulesetPath}/Attributes/${beatmapId}.json`;
    const attributesData = fs.readFileSync(attributesPath).toString();
    const attributes: IModdedAttributes = JSON.parse(attributesData);

    for (const acronym in attributes) {
      testBeatmap(beatmapPath, acronym, attributes[acronym]);
    }
  }
}

function testBeatmap(beatmapPath: string, acronym: string, data: ITestAttributes): void {
  describe(`${path.basename(beatmapPath)} +${acronym}`, () => {
    let difficulty: StandardDifficultyAttributes;
    let performance: StandardPerformanceAttributes;

    beforeAll(() => {
      const decoded = decoder.decodeFromString(fs.readFileSync(beatmapPath, 'utf8'), false);
      const mods = ruleset.createModCombination(acronym);
      const beatmap = ruleset.applyToBeatmapWithMods(decoded, mods);
      difficulty = ruleset.createDifficultyCalculator(beatmap).calculate();
      const score = simulateScore(beatmap, difficulty);
      performance = ruleset.createPerformanceCalculator(difficulty, score).calculateAttributes();
    });

    it('Should match beatmap max combo', () => {
      expect(difficulty.maxCombo).toEqual(data.maxCombo);
    });

    test('Should match total star rating', () => {
      expect(difficulty.starRating).toBeCloseTo(data.starRating, 6);
    });

    test('Should match aim difficulty', () => {
      expect(difficulty.aimDifficulty).toBeCloseTo(data.aimDifficulty, 6);
    });

    test('Should match speed difficulty', () => {
      expect(difficulty.speedDifficulty).toBeCloseTo(data.speedDifficulty, 6);
    });

    test('Should match speed note count', () => {
      expect(difficulty.speedNoteCount).toBeCloseTo(data.speedNoteCount, 6);
    });

    test('Should match flashlight difficulty', () => {
      expect(difficulty.flashlightDifficulty).toBeCloseTo(data.flashlightDifficulty, 6);
    });

    test('Should match slider factor', () => {
      expect(difficulty.sliderFactor).toBeCloseTo(data.sliderFactor, 2);
    });

    test('Should match approach rate', () => {
      expect(difficulty.approachRate).toBeCloseTo(data.approachRate, 2);
    });

    test('Should match overall difficulty', () => {
      expect(difficulty.overallDifficulty).toBeCloseTo(data.overallDifficulty, 2);
    });

    test('Should match total performance', () => {
      expect(performance.totalPerformance).toBeCloseTo(data.totalPerformance, 6);
    });

    test('Should match aim performance', () => {
      expect(performance.aimPerformance).toBeCloseTo(data.aimPerformance, 6);
    });

    test('Should match speed performance', () => {
      expect(performance.speedPerformance).toBeCloseTo(data.speedPerformance, 6);
    });

    test('Should match accuracy performance', () => {
      expect(performance.accuracyPerformance).toBeCloseTo(data.accuracyPerformance, 6);
    });

    test('Should match flashlight performance', () => {
      expect(performance.flashlightPerformance).toBeCloseTo(data.flashlightPerformance, 6);
    });

    test('Should match effective miss count', () => {
      expect(performance.effectiveMissCount).toBeCloseTo(data.effectiveMissCount, 2);
    });
  });
}

function simulateScore(beatmap: StandardBeatmap, attributes: StandardDifficultyAttributes): IScoreInfo {
  const score = new ScoreInfo({
    maxCombo: attributes.maxCombo,
    mods: attributes.mods,
    accuracy: 1,
  });

  score.statistics.set(HitResult.Great, beatmap.hitObjects.length);

  return score;
}
