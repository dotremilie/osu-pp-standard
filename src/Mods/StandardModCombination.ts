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
import { StandardScoreV2 } from './StandardScoreV2';

export class StandardModCombination extends ModCombination {
  constructor(input?: number | string) {
    super(typeof input === 'string' ? input.toUpperCase().replace(/SV2/g, '') : input);

    if (typeof input === 'string' && input.toUpperCase().match(/.{2}/g)
      ?.includes('CL')) {
      const noMod = this.all.findIndex((mod) => mod instanceof StandardNoMod);

      if (noMod >= 0) this.all.splice(noMod, 1);
      this.all.push(new StandardClassic());
    }

    if (typeof input === 'string' && input.toUpperCase().includes('SV2') &&
      !this.any(StandardScoreV2)) {
      const noMod = this.all.findIndex((mod) => mod instanceof StandardNoMod);

      if (noMod >= 0) this.all.splice(noMod, 1);
      this.all.push(new StandardScoreV2());
    }
  }

  clone(): this {
    const cloned = new StandardModCombination(this.toString()) as this;
    const classic = this.all.find((mod) => mod instanceof StandardClassic) as StandardClassic | undefined;
    const clonedClassic = cloned.all.find((mod) => mod instanceof StandardClassic) as StandardClassic | undefined;

    if (classic && clonedClassic) clonedClassic.noSliderHeadAccuracy = classic.noSliderHeadAccuracy;

    return cloned;
  }

  equals(other: ModCombination): boolean {
    const classic = this.all.find((mod) => mod instanceof StandardClassic) as StandardClassic | undefined;
    const otherClassic = other instanceof StandardModCombination
      ? other.all.find((mod) => mod instanceof StandardClassic) as StandardClassic | undefined : undefined;

    return this.bitwise === other.bitwise && this.mode === other.mode &&
      classic?.noSliderHeadAccuracy === otherClassic?.noSliderHeadAccuracy;
  }

  has(input: number | string): boolean {
    if (typeof input === 'string' && input.toUpperCase() === 'CL') return this.any(StandardClassic);
    if (typeof input === 'string' && input.toUpperCase() === 'SV2') return this.any(StandardScoreV2);

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
      new StandardScoreV2(),
    ];
  }
}
