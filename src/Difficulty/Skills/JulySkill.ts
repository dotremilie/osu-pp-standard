// Adapted from ppy/osu at 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject, Skill } from 'osu-classes';

/** Shared per-object history used by the July 2026 osu!standard skills. */
export abstract class JulySkill extends Skill {
  protected readonly _objectDifficulties: number[] = [];

  process(current: DifficultyHitObject): void {
    this._objectDifficulties.push(this._processObject(current));
  }

  get objectDifficulties(): readonly number[] {
    return this._objectDifficulties;
  }

  protected abstract _processObject(current: DifficultyHitObject): number;
}
