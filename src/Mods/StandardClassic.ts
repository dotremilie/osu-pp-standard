import { IMod, ModBitwise, ModType } from 'osu-classes';

/** Classic slider accuracy setting used by July 2026 osu!standard performance. */
export class StandardClassic implements IMod {
  name = 'Classic';
  acronym = 'CL';
  bitwise = ModBitwise.None;
  type = ModType.System;
  multiplier = 1;
  isRanked = true;
  incompatibles = ModBitwise.None;

  noSliderHeadAccuracy = true;
}
