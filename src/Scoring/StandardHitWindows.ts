// July 2026 hit-window rounding adapted from ppy/osu. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyRange, HitResult, HitWindows } from 'osu-classes';

export class StandardHitWindows extends HitWindows {
  private static readonly OSU_RANGES: DifficultyRange[] = [
    new DifficultyRange(HitResult.Great, 80, 50, 20),
    new DifficultyRange(HitResult.Ok, 140, 100, 60),
    new DifficultyRange(HitResult.Meh, 200, 150, 100),
    new DifficultyRange(HitResult.Miss, 400, 400, 400),
  ];

  private _greatWindow = 0;
  private _okWindow = 0;
  private _mehWindow = 0;

  setDifficulty(difficulty: number): void {
    this._greatWindow = Math.floor(DifficultyRange.map(difficulty, 80, 50, 20)) - 0.5;
    this._okWindow = Math.floor(DifficultyRange.map(difficulty, 140, 100, 60)) - 0.5;
    this._mehWindow = Math.floor(DifficultyRange.map(difficulty, 200, 150, 100)) - 0.5;
  }

  windowFor(result: HitResult): number {
    switch (result) {
      case HitResult.Great: return this._greatWindow;
      case HitResult.Ok: return this._okWindow;
      case HitResult.Meh: return this._mehWindow;
      case HitResult.Miss: return 400;
      default: return super.windowFor(result);
    }
  }

  isHitResultAllowed(result: HitResult): boolean {
    switch (result) {
      case HitResult.Great:
      case HitResult.Ok:
      case HitResult.Meh:
      case HitResult.Miss:
        return true;
    }

    return false;
  }

  protected _getRanges(): DifficultyRange[] {
    return StandardHitWindows.OSU_RANGES;
  }
}
