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
using osu.Game.Rulesets.Osu.Difficulty.Evaluators.Aim;
using osu.Game.Rulesets.Osu.Difficulty.Preprocessing;
using osu.Game.Rulesets.Osu.Difficulty.Skills;

namespace osu.Game.Rulesets.Osu.Tests
{
    [TestFixture]
    public class OsuAimSnapshotTest : OsuDifficultyCalculatorTest
    {
        [Test]
        public void WriteAimStrains()
        {
            var beatmap = GetBeatmap("diffcalc-test");
            var calculator = new CapturingCalculator(new OsuRuleset().RulesetInfo, beatmap);
            calculator.Calculate();

            File.WriteAllText(Path.Combine(TestContext.CurrentContext.WorkDirectory, "aim-objects.json"),
                JsonConvert.SerializeObject(calculator.Objects.Select((obj, index) => new
                {
                    index,
                    obj.StartTime,
                    obj.JumpDistance,
                    obj.LazyJumpDistance,
                    obj.LazyTravelDistance,
                    obj.Angle,
                    obj.NormalisedVectorAngle,
                    snap = SnapAimEvaluator.EvaluateDifficultyOf(obj, true),
                    agility = AgilityEvaluator.EvaluateDifficultyOf(obj),
                    flow = FlowAimEvaluator.EvaluateDifficultyOf(obj, true),
                    strain = calculator.AimStrains[index]
                })));
        }

        private class CapturingCalculator : OsuDifficultyCalculator
        {
            public double[] AimStrains { get; private set; } = Array.Empty<double>();
            public OsuDifficultyHitObject[] Objects { get; private set; } = Array.Empty<OsuDifficultyHitObject>();

            public CapturingCalculator(IRulesetInfo ruleset, IWorkingBeatmap beatmap)
                : base(ruleset, beatmap)
            {
            }

            protected override DifficultyAttributes CreateDifficultyAttributes(IBeatmap beatmap, Mod[] mods, Skill[] skills)
            {
                DifficultyAttributes attributes = base.CreateDifficultyAttributes(beatmap, mods, skills);
                AimStrains = skills.OfType<Aim>().Single(aim => aim.IncludeSliders).GetObjectDifficulties().ToArray();
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
