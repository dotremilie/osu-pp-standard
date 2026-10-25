using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using NUnit.Framework;
using osu.Game.Beatmaps;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Difficulty.Preprocessing;
using osu.Game.Rulesets.Difficulty.Skills;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Osu.Difficulty.Evaluators.Speed;
using osu.Game.Rulesets.Osu.Difficulty.Preprocessing;
using osu.Game.Rulesets.Osu.Difficulty.Skills;

namespace osu.Game.Rulesets.Osu.Tests
{
    [TestFixture]
    public class OsuSpeedSnapshotTest : OsuDifficultyCalculatorTest
    {
        [Test]
        public void WriteSpeedStrains()
        {
            var beatmap = GetBeatmap("801165");
            var calculator = new CapturingCalculator(new OsuRuleset().RulesetInfo, beatmap);

            calculator.Calculate();

            File.WriteAllText(Path.Combine(TestContext.CurrentContext.WorkDirectory, "speed-strains.json"),
                JsonConvert.SerializeObject(calculator.SpeedStrains));
            File.WriteAllText(Path.Combine(TestContext.CurrentContext.WorkDirectory, "speed-objects.json"),
                JsonConvert.SerializeObject(calculator.Objects.Select((obj, index) => new
                {
                    index,
                    obj.StartTime,
                    obj.DeltaTime,
                    obj.AdjustedDeltaTime,
                    obj.MinimumJumpTime,
                    obj.LastObjectEndDeltaTime,
                    obj.HitWindowGreat,
                    speed = SpeedEvaluator.EvaluateDifficultyOf(obj),
                    rhythm = RhythmEvaluator.EvaluateDifficultyOf(obj),
                    strain = calculator.SpeedStrains[index]
                })));
        }

        private class CapturingCalculator : OsuDifficultyCalculator
        {
            public double[] SpeedStrains { get; private set; } = Array.Empty<double>();
            public OsuDifficultyHitObject[] Objects { get; private set; } = Array.Empty<OsuDifficultyHitObject>();

            public CapturingCalculator(IRulesetInfo ruleset, IWorkingBeatmap beatmap)
                : base(ruleset, beatmap)
            {
            }

            protected override DifficultyAttributes CreateDifficultyAttributes(IBeatmap beatmap, Mod[] mods, Skill[] skills)
            {
                DifficultyAttributes attributes = base.CreateDifficultyAttributes(beatmap, mods, skills);
                SpeedStrains = skills.OfType<Speed>().Single().GetObjectDifficulties().ToArray();
                return attributes;
            }

            protected override IEnumerable<DifficultyHitObject> CreateDifficultyHitObjects(IBeatmap beatmap, Mod[] mods)
            {
                Objects = base.CreateDifficultyHitObjects(beatmap, mods).Cast<OsuDifficultyHitObject>().ToArray();
                return Objects;
            }
        }
    }
}
