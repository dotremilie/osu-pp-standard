# osu-pp-standard

TypeScript fork of [kionell/osu-standard-stable](https://github.com/kionell/osu-standard-stable) for osu!standard difficulty and PP calculation. It targets osu!standard difficulty version `20260706` from [ppy/osu `2026.711.0-lazer`](https://github.com/ppy/osu/tree/2026.711.0-lazer).

Package versions use `YYYY.MDD.REVISION`: difficulty version `20260706` corresponds to npm version `2026.706.0`. Fork fixes for the same calculator version increment `REVISION`.

Install the package and its beatmap dependencies:

```bash
npm install osu-pp-standard osu-classes osu-parsers
```

To build and test this fork locally:

```bash
npm ci
npm test
npm run build
```

`osu-classes` is a peer dependency. `osu-parsers` decodes `.osu` files for the example below; another compatible parser can be used instead.

## Calculate PP

```js
import fs from 'node:fs';
import { HitResult } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import { StandardHitResult, StandardRuleset, StandardScoreInfo } from 'osu-pp-standard';

const parsed = new BeatmapDecoder().decodeFromString(fs.readFileSync('map.osu', 'utf8'), false);
const ruleset = new StandardRuleset();
const mods = ruleset.createModCombination('HDDT');
const beatmap = ruleset.applyToBeatmapWithMods(parsed, mods);
const difficulty = ruleset.createDifficultyCalculator(beatmap).calculate();

const score = new StandardScoreInfo({
  maxCombo: difficulty.maxCombo,
  mods,
  accuracy: 1,
});
score.statistics.set(HitResult.Great, beatmap.hitObjects.length);
score.statistics.set(StandardHitResult.SliderTailHit, difficulty.sliderCount);

const performance = ruleset.createPerformanceCalculator(difficulty, score).calculateAttributes();
console.log(difficulty.starRating, performance.totalPerformance);
```

For a real score, provide its result counts, combo, accuracy, and available slider tail and tick results. Missing slider tail data is treated as every tail being hit. `CL` enables Classic slider accuracy; `SV2` marks legacy ScoreV2. `BL`, `TC`, and `DC` represent Blinds, Traceable, and default 0.75x Daycore. Preserve these acronyms when serializing mods because `osu-classes` 3.1 has no bitwise values for them. For a Classic ScoreV1 score, set `StandardScoreInfo.legacyTotalScore` to enable score-based miss estimation. Set `StandardClassic.noSliderHeadAccuracy = false` if that option was used.

## Checks

`npm test` covers the calculator's skill, timing, slider, and mod behavior. The test suite and build run before publication.

The calculation targets the July 2026 osu!standard rework. A local 1,000-map comparison found a maximum total PP difference of `0.0383` from the pinned C# implementation.

## License

This fork retains Kionell's MIT [license](LICENSE). Source adapted from ppy/osu and the July test fixtures are covered by the ppy [MIT notice](LICENCE.ppy).
