import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HitResult, ScoreInfo } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from '../lib/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDirectory = path.join(root, 'tests', 'Files', 'July2026');
const reference = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'reference.json'), 'utf8'));
const performanceReference = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'performance-reference.json'), 'utf8'));
const reportOnly = process.argv.includes('--report');
const tolerance = 0.00001;
const decoder = new BeatmapDecoder();
const ruleset = new StandardRuleset();
let failures = 0;

console.log(`Official osu!standard difficulty version ${reference.difficultyVersion}`);
console.log('Beatmap +mods                    Stars: fork / reference       Max combo: fork / reference');

for (const fixture of reference.cases) {
  const beatmapPath = path.join(fixtureDirectory, fixture.beatmap);
  const parsed = decoder.decodeFromString(fs.readFileSync(beatmapPath, 'utf8'), false);
  const mods = ruleset.createModCombination(fixture.mods);
  const beatmap = ruleset.applyToBeatmapWithMods(parsed, mods);
  const actual = ruleset.createDifficultyCalculator(beatmap).calculate();
  const matches = Number.isFinite(actual.starRating)
    && Math.abs(actual.starRating - fixture.starRating) <= tolerance
    && actual.maxCombo === fixture.maxCombo;

  if (!matches) failures += 1;

  const name = `${fixture.beatmap} +${fixture.mods}`.padEnd(32);
  const stars = `${actual.starRating.toFixed(6)} / ${fixture.starRating.toFixed(6)}`.padEnd(31);
  console.log(`${matches ? 'PASS' : 'DIFF'} ${name} ${stars} ${actual.maxCombo} / ${fixture.maxCombo}`);
}

console.log(`${reference.cases.length - failures}/${reference.cases.length} difficulty cases match within ${tolerance} stars and exact max combo.`);

console.log('\nPP cases: fork / reference');

for (const fixture of performanceReference) {
  const name = `${fixture.beatmap} +${fixture.mods} ${fixture.legacy ? 'stable' : 'lazer'} ${fixture.score.misses}m`;

  if (fixture.mods === 'CL') {
    console.log(`UNSUPPORTED ${name}: Classic mod is absent from this fork`);
    failures += 1;
    continue;
  }

  const beatmapPath = path.join(fixtureDirectory, fixture.beatmap);
  const parsed = decoder.decodeFromString(fs.readFileSync(beatmapPath, 'utf8'), false);
  const mods = ruleset.createModCombination(fixture.mods);
  const beatmap = ruleset.applyToBeatmapWithMods(parsed, mods);
  const difficulty = ruleset.createDifficultyCalculator(beatmap).calculate();
  const score = new ScoreInfo({
    maxCombo: fixture.score.maxCombo,
    mods,
    accuracy: fixture.score.accuracy,
  });
  score.statistics.set(HitResult.Great, fixture.score.greats);
  score.statistics.set(HitResult.Ok, fixture.score.oks);
  score.statistics.set(HitResult.Miss, fixture.score.misses);

  const actual = ruleset.createPerformanceCalculator(difficulty, score).calculateAttributes();
  const compared = [
    ['Total', actual.totalPerformance],
    ['Aim', actual.aimPerformance],
    ['Speed', actual.speedPerformance],
    ['Accuracy', actual.accuracyPerformance],
    ['Reading', actual.readingPerformance],
    ['Flashlight', actual.flashlightPerformance],
    ['EffectiveMissCount', actual.effectiveMissCount],
    ['SpeedDeviation', actual.speedDeviation],
  ];
  const differences = compared
    .filter(([field, value]) => !Number.isFinite(value)
      || Math.abs(value - fixture.performance[field]) > tolerance)
    .map(([field]) => field);

  if (differences.length > 0) failures += 1;

  console.log(`${differences.length === 0 ? 'PASS' : 'DIFF'} ${name}: ${actual.totalPerformance.toFixed(3)} / ${fixture.performance.Total.toFixed(3)} pp; differing: ${differences.join(', ') || 'none'}`);
}

console.log(`${performanceReference.length + reference.cases.length - failures}/${performanceReference.length + reference.cases.length} total cases match.`);

if (failures > 0 && !reportOnly) process.exitCode = 1;
