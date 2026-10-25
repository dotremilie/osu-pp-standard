import { ModCombination, IMod } from 'osu-classes';

import { StandardNoMod } from './StandardNoMod';
import { StandardNoFail } from './StandardNoFail';
import { StandardEasy } from './StandardEasy';
import { StandardTouchDevice } from './StandardTouchDevice';
import { StandardHidden } from './StandardHidden';
import { StandardHardRock } from './StandardHardRock';
import { StandardSuddenDeath } from './StandardSuddenDeath';
import { StandardDoubleTime } from './StandardDoubleTime';
import { StandardRelax } from './StandardRelax';
import { StandardHalfTime } from './StandardHalfTime';
import { StandardNightcore } from './StandardNightcore';
import { StandardFlashlight } from './StandardFlashlight';
import { StandardAutoplay } from './StandardAutoplay';
import { StandardSpunOut } from './StandardSpunOut';
import { StandardAutopilot } from './StandardAutopilot';
import { StandardPerfect } from './StandardPerfect';
import { StandardCinema } from './StandardCinema';
import { StandardClassic } from './StandardClassic';

export class StandardModCombination extends ModCombination {
  constructor(input?: number | string) {
    super(input);

    if (typeof input === 'string' && input.toUpperCase().match(/.{2}/g)
      ?.includes('CL')) {
      const noMod = this.all.findIndex((mod) => mod instanceof StandardNoMod);

      if (noMod >= 0) this.all.splice(noMod, 1);
      this.all.push(new StandardClassic());
    }
  }

  clone(): this {
    return new StandardModCombination(this.toString()) as this;
  }

  equals(other: ModCombination): boolean {
    return this.bitwise === other.bitwise && this.mode === other.mode &&
      this.any(StandardClassic) === (other instanceof StandardModCombination && other.any(StandardClassic));
  }

  has(input: number | string): boolean {
    if (typeof input === 'string' && input.toUpperCase() === 'CL') return this.any(StandardClassic);

    return super.has(input);
  }

  get mode(): number {
    return 0;
  }

  protected get _availableMods(): IMod[] {
    return [
      new StandardNoMod(),
      new StandardNoFail(),
      new StandardEasy(),
      new StandardTouchDevice(),
      new StandardHidden(),
      new StandardHardRock(),
      new StandardSuddenDeath(),
      new StandardDoubleTime(),
      new StandardRelax(),
      new StandardHalfTime(),
      new StandardNightcore(),
      new StandardFlashlight(),
      new StandardAutoplay(),
      new StandardSpunOut(),
      new StandardAutopilot(),
      new StandardPerfect(),
      new StandardCinema(),
    ];
  }
}
