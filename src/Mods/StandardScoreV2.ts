import { IMod, ModBitwise, ModType } from 'osu-classes';

/** Legacy ScoreV2 marker used by osu!standard performance calculation. */
export class StandardScoreV2 implements IMod {
  name = 'Score V2';
  acronym = 'SV2';
  bitwise = ModBitwise.ScoreV2;
  type = ModType.System;
  multiplier = 1;
  isRanked = true;
  incompatibles = ModBitwise.None;
}
