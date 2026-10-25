import { IMod, ModBitwise, ModType } from 'osu-classes';

/** Traceable marker for the July 2026 osu!standard performance bonuses. */
export class StandardTraceable implements IMod {
  name = 'Traceable';
  acronym = 'TC';
  bitwise = ModBitwise.None;
  type = ModType.DifficultyIncrease;
  multiplier = 1;
  isRanked = true;
  incompatibles = ModBitwise.Hidden;
}
