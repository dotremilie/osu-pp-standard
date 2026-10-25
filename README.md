# osu-pp-standard

TypeScript fork of [kionell/osu-standard-stable](https://github.com/kionell/osu-standard-stable) for osu!standard difficulty and performance calculation.

**Port status:** Slider preprocessing, hit-window rounding, and an internal Speed skill have been ported to July 2026. The active Aim, Speed, and PP formulas still come from upstream April 2025, so output does not yet match the official July 2026 rework. See [the reference comparison](docs/REFERENCE_20260706.md) before using its output as current PP. The original upstream API documentation follows below.

- Supports TypeScript.
- Based on the osu!lazer source code.
- Can apply & reset osu!standard mods.
- Difficulty and performance calculation (currently using the pre-rework formulas).
- Works in browsers.

## Installation

This fork is not published to npm yet. To work on it locally:

```bash
npm ci
npm run build
npm test
npm run compare:reference -- --report
```

`npm test` checks the ported components. `npm run compare:reference` is the full official parity gate and currently fails; publication also runs this gate.

## Requirements

Before you can start using this ruleset library, you need to install [osu-classes](https://github.com/kionell/osu-classes) package as this ruleset based on it. Also you need to install [osu-parsers](https://github.com/kionell/osu-parsers) or any other compatible beatmap parser that works with [IBeatmap](https://kionell.github.io/osu-classes/interfaces/IBeatmap.html) interface.

## Beatmap conversion

Any beatmap that implements IBeatmap interface can be converted to this ruleset. Unlike the game itself, you can convert beatmaps between different game modes, not just from osu!standard. This is possible due to the fact that hit objects from [osu-classes](https://github.com/kionell/osu-classes) keep their initial position taken from the .osu file. All beatmaps with applied ruleset keep the reference to the original beatmap, which allows you to repeat the process of conversion or apply different ruleset.

```js
import { BeatmapDecoder, BeatmapEncoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();
const encoder = new BeatmapEncoder();

const decodePath = 'path/to/your/decoding/file.osu';
const encodePath = 'path/to/your/encoding/file.osu';
const shouldParseSb = true;

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath, shouldParseSb);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// This will create a new shallow copy of a beatmap with applied osu!standard ruleset.
// This method implicitly applies mod combination of 0.
const standardWithNoMod = ruleset.applyToBeatmap(parsed);

// Create mod combination and apply it to beatmap.
const mods = ruleset.createModCombination(1337);
const standardWithMods = ruleset.applyToBeatmapWithMods(parsed, mods);

// It will write osu!standard beatmap with no mods to a file.
encoder.encodeToPath(encodePath, standardWithNoMod);

// It will write osu!standard beatmap with applied mods to a file.
encoder.encodeToPath(encodePath, standardWithMods);

// You can also write osu!standard beatmap object to a string.
const stringified = encoder.encodeToString(standardWithMods);
```

## Difficulty calculation

```js
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();

const decodePath = 'path/to/your/decoding/file.osu';

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// Create mod combination.
const mods = ruleset.createModCombination('HDDT');

// Create difficulty calculator for IBeatmap object.
const difficultyCalculator = ruleset.createDifficultyCalculator(parsed);

// You can pass any IBeatmap object to the difficulty calculator.
// Difficulty calculator will implicitly create a new beatmap with osu!standard ruleset.
const difficultyAttributes = difficultyCalculator.calculateWithMods(mods);
```

### Example of stringified difficulty attributes

```json
{
  "maxCombo": 2496,
  "mods": "HDDT",
  "starRating": 9.604287641287677,
  "aimDifficulty": 4.431096363500523,
  "speedDifficulty": 4.7498818169147095,
  "speedNoteCount": 411.55482693254766,
  "flashlightDifficulty": 6.310966523926074,
  "sliderFactor": 0.996588779020487,
  "approachRate": 10.53333346048991,
  "overallDifficulty": 10.111111111111112,
  "drainRate": 6,
  "hitCircleCount": 1162,
  "sliderCount": 619,
  "spinnerCount": 1
},
```

## Advanced difficulty calculation

```js
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();

const decodePath = 'path/to/your/decoding/file.osu';

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// Create mod combination and apply it to beatmap.
const mods = ruleset.createModCombination('HDHR');
const standardWithMods = ruleset.applyToBeatmapWithMods(parsed, mods);

/**
 * Any IBeatmap object can be used to create difficulty calculator. 
 * Difficulty calculator implicitly applies osu!standard ruleset with no mods.
 */
const difficultyCalculator1 = ruleset.createDifficultyCalculator(parsed);
const difficultyAttributes1 = difficultyCalculator1.calculate(); // no mods.
const moddedAttributes1 = difficultyCalculator1.calculateWithMods(mods); // with mods.

/**
 * If you pass osu!standard beatmap then it will use its ruleset and mods.
 */
const difficultyCalculator2 = ruleset.createDifficultyCalculator(standardWithMods);
const difficultyAttributes2 = difficultyCalculator2.calculate(); // with mods!
const moddedAttributes2 = difficultyCalculator2.calculateWithMods(mods); // the same as previous line.

/**
 * You can also pass custom clock rate as the last parameter.
 * It will be used instead of the original beatmap's clock rate.
 */
const customClockRate = 2;
const difficultyAttributes3 = difficultyCalculator2.calculate(customClockRate);
const moddedAttributes3 = difficultyCalculator2.calculateWithMods(mods, customClockRate);
```

## Gradual difficulty calculation

Sometimes you may need to calculate difficulty of a beatmap gradually and return attributes on every step of calculation. This is useful for real time difficulty calculation when you update your values depending on the current hit object. This can be really slow and RAM heavy for long beatmaps because attributes are created every 400 ms of the beatmap (default strain step).

```js
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();

const decodePath = 'path/to/your/decoding/file.osu';

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// Create mod combination and apply it to beatmap.
const mods = ruleset.createModCombination('HDDT');

// Create difficulty calculator for IBeatmap object.
const difficultyCalculator = ruleset.createDifficultyCalculator(parsed);

/**
 * Calculate timed difficulty attributes of the beatmap.
 */
const difficultyAttributes1 = difficultyCalculator.calculateTimed();
const difficultyAttributes2 = difficultyCalculator.calculateTimedWithMods(mods);

/**
 * Calculate time difficulty attributes with custom clock rate.
 */
const clockRate = 3;
const difficultyAttributes3 = difficultyCalculator.calculateTimed(mods, clockRate);
const difficultyAttributes4 = difficultyCalculator.calculateTimedWithMods(mods, clockRate);
```

## Partial difficulty calculation 

This is a special case of gradual difficulty calculation. This is useful when you need to get difficulty attributes at a specific point of the beatmap. Unlike the previous method, this one returns difficulty attributes only once without huge memory allocations.

```js
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();

const decodePath = 'path/to/your/decoding/file.osu';

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// Create mod combination and apply it to beatmap.
const mods = ruleset.createModCombination('EZHD');

// Create difficulty calculator for IBeatmap object.
const difficultyCalculator = ruleset.createDifficultyCalculator(parsed);

/**
 * Get object count for partial difficulty calculation.
 * This can be any number, but for example we will calculate first half of the beatmap.
 */
const totalObjects = Math.ceil(parsed.hitObjects.length / 2);

/**
 * Calculate difficulty at the middle of the beatmap.
 */
const partialAttributes1 = difficultyCalculator.calculateAt(totalObjects);
const partialAttributes2 = difficultyCalculator.calculateWithModsAt(mods, totalObjects);

/**
 * Calculate partial difficulty with custom clock rate.
 */
const clockRate = 1.2;
const partialAttributes3 = difficultyCalculator.calculateAt(totalObjects, clockRate);
const partialAttributes4 = difficultyCalculator.calculateWithModsAt(mods, totalObjects, clockRate);
```

## Calculating all possible modded attributes at once

Difficulty calculator can be used to calculate all attributes for every difficulty affecting modded combination. This can be time consuming for long beatmaps. All attributes are calculated inside generator function and returned as an iterator. Use JS spread syntax if you want to convert attributes to array.

```js
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();

const decodePath = 'path/to/your/decoding/file.osu';

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// Create difficulty calculator for IBeatmap object.
const difficultyCalculator = ruleset.createDifficultyCalculator(parsed);

/**
 * Calculate difficulty at the middle of the beatmap.
 */
for (const attributes of difficultyCalculator.calculateAll()) {
  // Do your stuff with calculated attributes...
}
```

## Performance calculation

```js
import { ScoreInfo } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import { StandardRuleset } from 'osu-pp-standard';

const decoder = new BeatmapDecoder();

const decodePath = 'path/to/your/decoding/file.osu';

// Get beatmap object.
const parsed = decoder.decodeFromPath(decodePath);

// Create a new osu!standard ruleset.
const ruleset = new StandardRuleset();

// Create mod combination and apply it to beatmap.
const mods = ruleset.createModCombination('HDDT');
const standardBeatmap = ruleset.applyToBeatmapWithMods(parsed, mods);

// Create difficulty calculator for osu!std beatmap.
const difficultyCalculator = ruleset.createDifficultyCalculator(standardBeatmap);

// Calculate difficulty attributes.
const difficultyAttributes = difficultyCalculator.calculate();

// MariannE (Yooh) [Collab]
// mrekk + HDDT 1371.45 pp.
const score = new ScoreInfo({
  maxCombo: 2492,
  rulesetId: 0,
  count300: 1756, // score.statistics.great
  count100: 26, // score.statistics.good
  count50: 0, // score.statistics.meh
  countMiss: 0, // score.statistics.miss
  mods,
});

score.accuracy = (score.count300 + (score.count100 / 3) + (score.count50 / 6)) 
  / (score.count300 + score.count100 + score.count50 + score.countMiss);

// Create performance calculator for osu!std ruleset.
const performanceCalculator = ruleset.createPerformanceCalculator(difficultyAttributes, score);

// Calculate performance attributes for a map.
const performanceAttributes = performanceCalculator.calculateAttributes();

// Calculate total performance for a map.
const totalPerformance = performanceCalculator.calculate();
```

### Example of stringified performance attributes

```json
{
  "mods": "HDDT",
  "totalPerformance": 1371.4670260135895,
  "aimPerformance": 513.6728800186834,
  "speedPerformance": 643.653687558857,
  "accuracyPerformance": 155.40643792332443,
  "flashlightPerformance": 0,
  "effectiveMissCount": 0
}
```

## Documentation

The [upstream API documentation](https://kionell.github.io/osu-standard-stable/) describes the inherited interfaces. It does not document the July 2026 port yet.

## License

This fork retains the upstream MIT license in [LICENSE](LICENSE). The July reference fixtures are from [ppy/osu](https://github.com/ppy/osu); their MIT notice is in [LICENCE.ppy](tests/Files/July2026/LICENCE.ppy).
