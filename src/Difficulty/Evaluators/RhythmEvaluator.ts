// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { MathUtils } from 'osu-classes';
import { Slider, Spinner } from '../../Objects';
import { StandardDifficultyHitObject } from '../Preprocessing';

class Island {
  delta: number;
  deltaCount = 1;
  occurrences = 1;

  constructor(delta: number) {
    this.delta = Math.max(delta, 25);
  }

  addDelta(delta: number): void {
    if (this.delta === 2147483647) this.delta = Math.max(delta, 25);

    this.deltaCount++;
  }

  isSimilarPolarity(other: Island, epsilon: number): boolean {
    if (this.deltaCount <= 1 || other.deltaCount <= 1) return false;

    return Math.abs(this.delta - other.delta) < epsilon &&
      this.deltaCount % 2 === other.deltaCount % 2;
  }

  almostEquals(other: Island, epsilon: number): boolean {
    return Math.abs(this.delta - other.delta) < epsilon && this.deltaCount === other.deltaCount;
  }
}

/** July 2026 rhythm multiplier for one osu!standard difficulty object. */
export class RhythmEvaluator {
  private static readonly HISTORY_TIME_MAX = 5000;
  private static readonly HISTORY_OBJECTS_MAX = 32;
  private static readonly RHYTHM_MULTIPLIER = 0.95;

  static evaluateDifficultyOf(current: StandardDifficultyHitObject): number {
    if (current.baseObject instanceof Spinner) return 0;

    const historicalNoteCount = Math.min(current.index, this.HISTORY_OBJECTS_MAX);

    if (historicalNoteCount < 3) return 1;

    const deltaEpsilon = current.hitWindowGreat * 0.3;
    const islands: Island[] = [];
    let island = new Island(2147483647);
    let previousIsland = new Island(2147483647);
    let rhythmComplexitySum = 0;
    let startDifficulty = 0;
    let firstDeltaSwitch = false;
    let rhythmStart = 0;

    while (rhythmStart < historicalNoteCount - 2 &&
      current.startTime - current.previous(rhythmStart)!.startTime < this.HISTORY_TIME_MAX) {
      rhythmStart++;
    }

    let previous = current.previous(rhythmStart) as StandardDifficultyHitObject;
    let previousPrevious = current.previous(rhythmStart + 1) as StandardDifficultyHitObject;

    for (let i = rhythmStart; i > 0; --i) {
      const object = current.previous(i - 1) as StandardDifficultyHitObject;

      if (object.baseObject instanceof Spinner) continue;

      const timeDecay = (this.HISTORY_TIME_MAX - (current.startTime - object.startTime)) / this.HISTORY_TIME_MAX;
      const noteDecay = (historicalNoteCount - i) / historicalNoteCount;
      const historicalDecay = Math.min(noteDecay, timeDecay);
      const currentDelta = Math.max(object.deltaTime, 1e-7);
      const previousDelta = Math.max(previous.deltaTime, 1e-7);
      const deltaDifference = Math.abs(previousDelta - currentDelta);

      if (island.delta === 2147483647) island = new Island(Math.trunc(currentDelta));

      const deltaRatio = Math.max(previousDelta, currentDelta) / Math.min(previousDelta, currentDelta);
      const differenceMultiplier = MathUtils.clamp(2 - deltaRatio / 8, 0, 1);
      const windowPenalty = MathUtils.clamp((deltaDifference - deltaEpsilon) / deltaEpsilon, 0, 1);
      let effectiveDifficulty = this._effectiveDifficulty(deltaRatio) * windowPenalty * differenceMultiplier;

      if (previous.baseObject instanceof Slider) {
        const lazyDelta = object.minimumJumpTime;
        const lazyRatio = Math.max(lazyDelta, currentDelta) / Math.min(lazyDelta, currentDelta);
        const realDelta = object.lastObjectEndDeltaTime;
        const realRatio = Math.max(realDelta, currentDelta) / Math.min(realDelta, currentDelta);

        effectiveDifficulty = Math.min(effectiveDifficulty,
          this._effectiveDifficulty(lazyRatio),
          this._effectiveDifficulty(realRatio));
      }

      if (deltaDifference < deltaEpsilon) island.addDelta(Math.trunc(currentDelta));

      if (firstDeltaSwitch) {
        if (deltaDifference > deltaEpsilon) {
          if (object.baseObject instanceof Slider) effectiveDifficulty *= 0.5;
          if (island.isSimilarPolarity(previousIsland, deltaEpsilon)) effectiveDifficulty *= 0.5;

          if (Math.max(previousPrevious.deltaTime, 1e-7) > previousDelta + deltaEpsilon &&
            previousDelta > currentDelta + deltaEpsilon) effectiveDifficulty *= 0.125;

          if (previousIsland.deltaCount === island.deltaCount) effectiveDifficulty *= 0.5;
          if (previousDelta > currentDelta + deltaEpsilon) effectiveDifficulty *= 0.65;

          let found = false;

          for (const existing of islands) {
            if (!existing.almostEquals(island, deltaEpsilon)) continue;

            if (previousIsland.almostEquals(island, deltaEpsilon)) existing.occurrences++;

            const power = 2.75 / (1 + Math.exp(0.24 * (58.33 - island.delta)));

            effectiveDifficulty *= Math.min(3 / existing.occurrences,
              Math.pow(1 / existing.occurrences, power));

            found = true;
            break;
          }

          if (!found && island.deltaCount > 0) islands.push(island);

          effectiveDifficulty *= 1 - previous.calculateDoubleTapFeasibility(object) * 0.75;

          rhythmComplexitySum += island.deltaCount > 1
            ? Math.sqrt(effectiveDifficulty * startDifficulty) * historicalDecay
            : 0.7 * historicalDecay;

          startDifficulty = effectiveDifficulty;

          if (previousDelta + deltaEpsilon < currentDelta) firstDeltaSwitch = false;

          previousIsland = island;
          island = new Island(Math.trunc(currentDelta));
        }
      }
      else if (previousDelta > currentDelta + deltaEpsilon) {
        firstDeltaSwitch = true;

        if (object.baseObject instanceof Slider) effectiveDifficulty *= 0.6;
        if (previous.baseObject instanceof Slider) effectiveDifficulty *= 0.6;

        startDifficulty = effectiveDifficulty;
        island = new Island(Math.trunc(currentDelta));
      }

      previousPrevious = previous;
      previous = object;
    }

    rhythmComplexitySum *= MathUtils.clamp((island.deltaCount - 22) / (3 - 22), 0, 1);

    return Math.sqrt(4 + rhythmComplexitySum * this.RHYTHM_MULTIPLIER) / 2;
  }

  private static _effectiveDifficulty(deltaRatio: number): number {
    const fraction = deltaRatio - Math.trunc(deltaRatio);
    const x = MathUtils.clamp((0.5 - Math.abs(fraction - 0.5)) * 2, 0, 1);
    const bellCurve = x * x * (3 - 2 * x);

    return 1 + 26 * Math.min(0.5, bellCurve);
  }
}
