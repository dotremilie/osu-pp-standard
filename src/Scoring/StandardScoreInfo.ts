import { ScoreInfo } from 'osu-classes';

/** Adds the ScoreV1 total used by osu!standard Classic miss estimation. */
export class StandardScoreInfo extends ScoreInfo {
  legacyTotalScore: number | null = null;
}
