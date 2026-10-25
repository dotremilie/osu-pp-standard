import { HalfTime, ModBitwise } from 'osu-classes';

/** Default 0.75x Daycore rate for July 2026 osu!standard PP. */
export class StandardDaycore extends HalfTime {
  name = 'Daycore';
  acronym = 'DC';
  bitwise = ModBitwise.None;
}
