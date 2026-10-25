import { IMod, ModBitwise, ModType } from 'osu-classes';

/** Blinds marker for the July 2026 osu!standard performance bonuses. */
export class StandardBlinds implements IMod {
  name = 'Blinds';
  acronym = 'BL';
  bitwise = ModBitwise.None;
  type = ModType.DifficultyIncrease;
  multiplier = 1;
  isRanked = true;
  incompatibles = ModBitwise.Flashlight;
}
