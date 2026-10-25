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
            addCase("diffcalc-test", "NM", Array.Empty<Mod>(), false, 0, 0, 5, cases, tailsDropped: 5);
            addCase("diffcalc-test", "NM", Array.Empty<Mod>(), false, 0, 0, 1, cases, tickMisses: 1);
            addCase("diffcalc-test", "DT", new Mod[] { new OsuModDoubleTime() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "HD", new Mod[] { new OsuModHidden() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "FL", new Mod[] { new OsuModFlashlight() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "HDFL", new Mod[] { new OsuModHidden(), new OsuModFlashlight() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "HR", new Mod[] { new OsuModHardRock() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "RX", new Mod[] { new OsuModRelax() }, false, 1, 10, 20, cases);
            addCase("diffcalc-test", "AP", new Mod[] { new OsuModAutopilot() }, false, 0, 0, 0, cases);
            addCase("diffcalc-test", "NF", new Mod[] { new OsuModNoFail() }, false, 1, 10, 20, cases);
            addCase("diffcalc-test", "CL", new Mod[] { new OsuModClassic() }, true, 0, 0, 0, cases);
            addCase("diffcalc-test", "CL", new Mod[] { new OsuModClassic() }, true, 1, 10, 20, cases);
            addCase("801165", "NM", Array.Empty<Mod>(), false, 0, 0, 0, cases);

            File.WriteAllText(Path.Combine(TestContext.CurrentContext.WorkDirectory, "july-reference.json"),
                JsonConvert.SerializeObject(cases, Formatting.Indented));
        }

        private void addCase(string name, string acronym, Mod[] mods, bool legacy, int misses, int oks, int comboDrop, List<object> cases, int tailsDropped = 0, int tickMisses = 0)
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
                    [HitResult.SliderTailHit] = difficulty.SliderCount - tailsDropped,
                    [HitResult.LargeTickMiss] = tickMisses
                }
            };

            var performance = (OsuPerformanceAttributes)new OsuPerformanceCalculator().Calculate(score, difficulty);

            cases.Add(new
            {
                beatmap = name + ".osu",
                mods = acronym,
                legacy,
                score = new { greats, oks, misses, maxCombo = score.MaxCombo, accuracy = score.Accuracy, sliderTailHits = difficulty.SliderCount - tailsDropped, largeTickMisses = tickMisses },
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
