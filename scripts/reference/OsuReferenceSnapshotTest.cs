using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using NUnit.Framework;
using osu.Game.Beatmaps;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Osu.Mods;
using osu.Game.Rulesets.Scoring;
using osu.Game.Scoring;

namespace osu.Game.Rulesets.Osu.Tests
{
    [TestFixture]
    public class OsuReferenceSnapshotTest : OsuDifficultyCalculatorTest
    {
        [Test]
        public void WriteJulyReference()
        {
            var cases = new List<object>();
            addCase("diffcalc-test", "NM", Array.Empty<Mod>(), false, 0, 0, 0, cases);
            addCase("diffcalc-test", "NM", Array.Empty<Mod>(), false, 1, 10, 20, cases);
            addCase("diffcalc-test", "DT", new Mod[] { new OsuModDoubleTime() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "HD", new Mod[] { new OsuModHidden() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "CL", new Mod[] { new OsuModClassic() }, true, 0, 0, 0, cases);
            addCase("801165", "NM", Array.Empty<Mod>(), false, 0, 0, 0, cases);

            File.WriteAllText(Path.Combine(TestContext.CurrentContext.WorkDirectory, "july-reference.json"),
                JsonConvert.SerializeObject(cases, Formatting.Indented));
        }

        private void addCase(string name, string acronym, Mod[] mods, bool legacy, int misses, int oks, int comboDrop, List<object> cases)
        {
            var beatmap = GetBeatmap(name);
            var difficulty = (OsuDifficultyAttributes)CreateDifficultyCalculator(beatmap).Calculate(mods);
            int totalHits = beatmap.Beatmap.HitObjects.Count;
            int greats = totalHits - oks - misses;

            var score = new ScoreInfo((BeatmapInfo)beatmap.BeatmapInfo, new OsuRuleset().RulesetInfo)
            {
                Mods = mods,
                IsLegacyScore = legacy,
                MaxCombo = difficulty.MaxCombo - comboDrop,
                Accuracy = (greats + oks / 3.0) / totalHits,
                Statistics = new Dictionary<HitResult, int>
                {
                    [HitResult.Great] = greats,
                    [HitResult.Ok] = oks,
                    [HitResult.Miss] = misses,
                    [HitResult.SliderTailHit] = difficulty.SliderCount
                }
            };

            var performance = (OsuPerformanceAttributes)new OsuPerformanceCalculator().Calculate(score, difficulty);

            cases.Add(new
            {
                beatmap = name + ".osu",
                mods = acronym,
                legacy,
                score = new { greats, oks, misses, maxCombo = score.MaxCombo, accuracy = score.Accuracy },
                difficulty = new
                {
                    difficulty.StarRating,
                    difficulty.MaxCombo,
                    difficulty.AimDifficulty,
                    difficulty.SpeedDifficulty,
                    difficulty.ReadingDifficulty,
                    difficulty.FlashlightDifficulty,
                    difficulty.SpeedNoteCount,
                    difficulty.SliderFactor
                },
                performance = new
                {
                    performance.Total,
                    performance.Aim,
                    performance.Speed,
                    performance.Accuracy,
                    performance.Reading,
                    performance.Flashlight,
                    performance.EffectiveMissCount,
                    performance.SpeedDeviation
                }
            });
        }
    }
}
