// Diagnostic fixture for ppy/osu 2026.711.0-lazer. Copyright (c) ppy Pty Ltd, MIT.
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
using osu.Game.Rulesets.Osu.Difficulty.Evaluators;
using osu.Game.Rulesets.Osu.Difficulty.Preprocessing;
using osu.Game.Rulesets.Osu.Difficulty.Skills;
using osu.Game.Rulesets.Osu.Objects;

namespace osu.Game.Rulesets.Osu.Tests
{
    [TestFixture]
    public class OsuReadingSnapshotTest : OsuDifficultyCalculatorTest
    {
        [Test]
        public void WriteReadingStrains()
        {
            var beatmap = GetBeatmap("diffcalc-test");
            var calculator = new CapturingCalculator(new OsuRuleset().RulesetInfo, beatmap);
            calculator.Calculate();

            File.WriteAllText(Path.Combine(TestContext.CurrentContext.WorkDirectory, "reading-objects.json"),
                JsonConvert.SerializeObject(calculator.Objects.Select((obj, index) => new
                {
                    index,
                    obj.StartTime,
                    obj.DeltaTime,
                    obj.AdjustedDeltaTime,
                    obj.Preempt,
                    obj.LazyJumpDistance,
                    Radius = ((OsuHitObject)obj.BaseObject).Radius,
                    obj.Angle,
                    evaluator = ReadingEvaluator.EvaluateDifficultyOf(obj, false),
                    strain = calculator.ReadingStrains[index]
                })));
        }

        private class CapturingCalculator : OsuDifficultyCalculator
        {
            public double[] ReadingStrains { get; private set; } = Array.Empty<double>();
            public OsuDifficultyHitObject[] Objects { get; private set; } = Array.Empty<OsuDifficultyHitObject>();

            public CapturingCalculator(IRulesetInfo ruleset, IWorkingBeatmap beatmap)
                : base(ruleset, beatmap)
            {
            }

            protected override DifficultyAttributes CreateDifficultyAttributes(IBeatmap beatmap, Mod[] mods, Skill[] skills)
            {
                DifficultyAttributes attributes = base.CreateDifficultyAttributes(beatmap, mods, skills);
                ReadingStrains = skills.OfType<Reading>().Single().GetObjectDifficulties().ToArray();
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
