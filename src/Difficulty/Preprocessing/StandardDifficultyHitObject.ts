// July 2026 preprocessing adapted from ppy/osu. Copyright (c) ppy Pty Ltd, MIT; see LICENCE.ppy.
import { DifficultyHitObject, HitResult, IHitObject, MathUtils, Vector2 } from 'osu-classes';
import { StandardHidden } from '../../Mods';
import { Slider, SliderRepeat, SliderTick, Spinner, StandardHitObject } from '../../Objects';

export class StandardDifficultyHitObject extends DifficultyHitObject {
  /**
   * A distance by which all distances should be scaled in order to assume a uniform circle size.
   */
  private static readonly NORMALIZED_RADIUS = 50;
  private static readonly MIN_DELTA_TIME = 25;
  private static readonly TAIL_LENIENCY = -36;
  private static readonly MAXIMUM_SLIDER_RADIUS = Math.fround(this.NORMALIZED_RADIUS * Math.fround(2.4));
  private static readonly ASSUMED_SLIDER_RADIUS = Math.fround(this.NORMALIZED_RADIUS * Math.fround(1.8));

  /**
   * Milliseconds elapsed since the start time of the previous  
   * {@link StandardDifficultyHitObject}, with a minimum of 25ms.
   */
  readonly strainTime: number;

  /** Delta time capped at 25ms for the July 2026 skill calculations. */
  readonly adjustedDeltaTime: number;

  /** Time since the previous difficulty object's end, capped at 25ms. */
  readonly lastObjectEndDeltaTime: number;

  /** Clock rate adjusted approach time. */
  readonly preempt: number;

  /** Normalized start-to-start distance from the previous hit object. */
  jumpDistance = 0;

  /** Direction of the current movement, folded across both axes. */
  normalisedVectorAngle: number | null = null;

  get smallCircleBonus(): number {
    return Math.max(1, 1 + (30 - this.baseObject.radius) / 70);
  }

  get overallDifficulty(): number {
    return (79.5 - this.hitWindowGreat / 2) / 6;
  }

  /**
   * Normalized distance from the end position of the previous 
   * {@link StandardDifficultyHitObject} to the start position of this {@link StandardDifficultyHitObject}.
   * The "lazy" end position is the position at which the cursor ends up if the previous hitobject 
   * is followed with as minimal movement as possible (i.e. on the edge of slider follow circles).
   */
  lazyJumpDistance = 0;

  /**
   * Normalised shortest distance to consider for a jump between the previou
   * {@link StandardDifficultyHitObject} and this {@link StandardDifficultyHitObject}.
   * This is bounded from above by {@link lazyJumpDistance}, and is smaller than the former 
   * if a more natural path is able to be taken through the previous {@link StandardDifficultyHitObject}.
   */
  minimumJumpDistance = 0;

  /**
   * The time taken to travel through {@link minimumJumpDistance}, with a minimum of 25ms.
   */
  minimumJumpTime = 0;

  /**
   * Normalised distance between the start and end position of this {@link StandardDifficultyHitObject}.
   */
  travelDistance = 0;

  /**
   * The time taken to travel through {@link travelDistance}, with a minimum value of 25ms {@link Slider} objects.
   */
  travelTime = 0;

  /**
   * Angle the player has to take to hit this {@link StandardDifficultyHitObject}.
   * Calculated as the angle between the circles (current-2, current-1, current).
   */
  angle: number | null = null;

  /**
   * Retrieves the full hit window for a Great {@link HitResult}.
   */
  hitWindowGreat = 0;

  readonly baseObject: StandardHitObject;
  readonly lastObject: StandardHitObject;

  constructor(
    hitObject: IHitObject,
    lastObject: IHitObject,
    clockRate: number,
    objects: StandardDifficultyHitObject[],
    index: number,
  ) {
    super(hitObject, lastObject, clockRate, objects, index);

    this.baseObject = hitObject as StandardHitObject;
    this.lastObject = lastObject as StandardHitObject;

    /**
     * Capped to 25ms to prevent difficulty calculation breaking from simultaneous objects.
     */
    this.strainTime = Math.max(this.deltaTime, StandardDifficultyHitObject.MIN_DELTA_TIME);
    this.adjustedDeltaTime = this.strainTime;

    const previous = this.previous(0);

    this.lastObjectEndDeltaTime = previous
      ? Math.max(this.startTime - previous.endTime, StandardDifficultyHitObject.MIN_DELTA_TIME)
      : this.adjustedDeltaTime;

    this.preempt = this.baseObject.timePreempt / clockRate;
    this.hitWindowGreat = this.baseObject instanceof Slider && this.baseObject.head
      ? 2 * this.baseObject.head.hitWindows.windowFor(HitResult.Great) / clockRate
      : 2 * this.baseObject.hitWindows.windowFor(HitResult.Great) / clockRate;

    this._setDistances(clockRate);
  }

  opacityAt(time: number, hidden: boolean): number {
    if (time > this.baseObject.startTime) return 0;

    const fadeInStartTime = this.baseObject.startTime - this.baseObject.timePreempt;
    const fadeInDuration = 400 * Math.min(1, this.baseObject.timePreempt / StandardHitObject.PREEMPT_MIN);

    if (hidden) {
      const fadeOutStartTime = this.baseObject.startTime -
        this.baseObject.timePreempt + this.baseObject.timeFadeIn;

      const fadeOutDuration = this.baseObject.timePreempt *
        StandardHidden.FADE_OUT_DURATION_MULTIPLIER;

      return Math.min(
        MathUtils.clamp((time - fadeInStartTime) / fadeInDuration, 0, 1),
        1.0 - MathUtils.clamp((time - fadeOutStartTime) / fadeOutDuration, 0, 1),
      );
    }

    return MathUtils.clamp((time - fadeInStartTime) / fadeInDuration, 0, 1);
  }

  /** Feasibility of double tapping this object with the next one, from 0 to 1. */
  calculateDoubleTapFeasibility(next: StandardDifficultyHitObject | null): number {
    if (next === null) return 0;

    const currentDelta = Math.max(1, this.deltaTime);
    const nextDelta = Math.max(1, next.deltaTime);
    const deltaDifference = Math.abs(nextDelta - currentDelta);
    const speedRatio = currentDelta / Math.max(currentDelta, deltaDifference);
    const windowRatio = Math.pow(Math.min(1, currentDelta / this.hitWindowGreat), 5);
    const distanceFactor = Math.pow(MathUtils.clamp((this.lazyJumpDistance - 100) / (50 - 100), 0, 1), 2);

    return 1 - Math.pow(speedRatio, distanceFactor * (1 - windowRatio));
  }

  private _setDistances(clockRate: number): void {
    const baseObj = this.baseObject as StandardHitObject;
    const lastObj = this.lastObject as StandardHitObject;

    this.minimumJumpTime = this.adjustedDeltaTime;

    if (baseObj instanceof Slider) {
      this._computeSliderCursorPosition(baseObj);

      this.travelDistance = baseObj.lazyTravelDistance * Math.max(1, Math.pow(baseObj.repeats, 0.3));

      this.travelTime = Math.max(
        baseObj.lazyTravelTime / clockRate,
        StandardDifficultyHitObject.MIN_DELTA_TIME,
      );
    }

    /**
     * We don't need to calculate either angle or distance 
     * when one of the last->curr objects is a spinner.
     */
    if (baseObj instanceof Spinner || lastObj instanceof Spinner) {
      return;
    }

    /**
     * We will scale distances by this factor, 
     * so we can assume a uniform CircleSize among beatmaps.
     */
    const scalingFactor = Math.fround(
      StandardDifficultyHitObject.NORMALIZED_RADIUS / Math.fround(baseObj.radius),
    );

    const lastCursorPosition = this._getEndCursorPosition(lastObj);

    const scaledStackPos = baseObj.stackedStartPosition.fscale(scalingFactor);
    const scaledLastStackPos = lastObj.stackedStartPosition.fscale(scalingFactor);
    const scaledCursorPos = lastCursorPosition.fscale(scalingFactor);

    this.jumpDistance = scaledStackPos.fsubtract(scaledLastStackPos).flength();
    this.lazyJumpDistance = scaledStackPos.fsubtract(scaledCursorPos).flength();
    this.minimumJumpDistance = this.lazyJumpDistance;

    const lastDifficultyObject = this.previous(0) as StandardDifficultyHitObject | null;

    if (lastObj instanceof Slider && lastDifficultyObject !== null) {
      const lastTraveTime = Math.max(lastObj.lazyTravelTime / clockRate,
        StandardDifficultyHitObject.MIN_DELTA_TIME);

      this.minimumJumpTime = Math.max(
        this.adjustedDeltaTime - lastTraveTime,
        StandardDifficultyHitObject.MIN_DELTA_TIME,
      );

      const tailStackPos = lastObj.tail?.stackedStartPosition ?? lastObj.stackedStartPosition;
      const baseStackPos = baseObj.stackedStartPosition;

      const tailJumpDistance = Math.fround(
        tailStackPos.fsubtract(baseStackPos).flength() * scalingFactor,
      );

      const maxSliderRadius = StandardDifficultyHitObject.MAXIMUM_SLIDER_RADIUS;
      const assumedSliderRadius = StandardDifficultyHitObject.ASSUMED_SLIDER_RADIUS;

      this.minimumJumpDistance = Math.max(0, Math.min(
        this.lazyJumpDistance - (maxSliderRadius - assumedSliderRadius),
        tailJumpDistance - maxSliderRadius,
      ));
    }

    const lastLastDifficultyObject = this.previous(1) as StandardDifficultyHitObject | null;

    if (lastLastDifficultyObject !== null && !(lastLastDifficultyObject.baseObject instanceof Spinner)) {
      let lastLastCursorPosition = this._getEndCursorPosition(lastLastDifficultyObject.baseObject);
      let angleCursorPosition = lastCursorPosition;

      if (lastDifficultyObject?.baseObject instanceof Slider && lastDifficultyObject.travelDistance > 0) {
        angleCursorPosition = lastDifficultyObject.baseObject.head?.stackedStartPosition ?? lastObj.stackedStartPosition;
      }

      const angle = this._calculateAngle(baseObj.stackedStartPosition, angleCursorPosition, lastLastCursorPosition);
      const sliderCursorPosition = this._getEndCursorPosition(lastObj);

      if (lastDifficultyObject?.baseObject instanceof Slider && lastDifficultyObject.travelDistance > 0) {
        const nested = lastDifficultyObject.baseObject.nestedHitObjects;

        lastLastCursorPosition = (nested[nested.length - 2] as StandardHitObject).stackedStartPosition;
      }

      const sliderAngle = this._calculateAngle(baseObj.stackedStartPosition, sliderCursorPosition, lastLastCursorPosition);
      const movement = baseObj.stackedStartPosition.fsubtract(angleCursorPosition);

      this.normalisedVectorAngle = Math.atan2(Math.abs(movement.floatY), Math.abs(movement.floatX));
      this.angle = Math.min(angle, sliderAngle);
    }
  }

  private _calculateAngle(current: Vector2, last: Vector2, lastLast: Vector2): number {
    const v1 = lastLast.fsubtract(last);
    const v2 = current.fsubtract(last);
    const dot = v1.fdot(v2);
    const det = Math.fround(v1.floatX * v2.floatY - v1.floatY * v2.floatX);

    return Math.abs(Math.atan2(det, dot));
  }

  private _computeSliderCursorPosition(slider: Slider): void {
    if (slider.lazyEndPosition) return;

    let trackingEndTime = Math.max(
      slider.endTime + StandardDifficultyHitObject.TAIL_LENIENCY,
      slider.startTime + slider.duration / 2,
    );

    const lastTick = [...slider.nestedHitObjects].reverse().find((nested) => nested instanceof SliderTick);
    let nestedObjects = slider.nestedHitObjects;

    if (lastTick && lastTick.startTime > trackingEndTime) {
      trackingEndTime = lastTick.startTime;
      nestedObjects = slider.nestedHitObjects.filter((nested) => nested !== lastTick).concat(lastTick);
    }

    slider.lazyTravelTime = trackingEndTime - slider.startTime;

    let endTimeMin = slider.lazyTravelTime / slider.spanDuration;

    endTimeMin = endTimeMin % 2 >= 1 ? 1 - endTimeMin % 1 : endTimeMin % 1;

    const endPosition = slider.path.positionAt(endTimeMin);

    /**
     * Temporary lazy end position until a real result can be derived.
     */
    slider.lazyEndPosition = slider.stackedStartPosition.fadd(endPosition);

    let currCursorPosition = slider.stackedStartPosition;

    /**
     * Lazy slider distance is coded to be sensitive to scaling, 
     * this makes the maths easier with the thresholds being used.
     */
    const scalingFactor = StandardDifficultyHitObject.NORMALIZED_RADIUS / slider.radius;

    for (let i = 1; i < nestedObjects.length; ++i) {
      const currMovementObj = nestedObjects[i] as StandardHitObject;

      let currMovement = currMovementObj.stackedStartPosition.fsubtract(currCursorPosition);
      let currMovementLength = scalingFactor * currMovement.flength();

      /**
       * Amount of movement required so that the cursor position needs to be updated.
       */
      let requiredMovement = StandardDifficultyHitObject.ASSUMED_SLIDER_RADIUS;

      if (i === nestedObjects.length - 1) {
        /**
         * The end of a slider has special aim rules due to the relaxed time constraint on position.
         * There is both a lazy end position as well as the actual end slider position. 
         * We assume the player takes the simpler movement.
         * For sliders that are circular, the lazy end position 
         * may actually be farther away than the sliders true end.
         * This code is designed to prevent buffing situations 
         * where lazy end is actually a less efficient movement.
         */
        const lazyMovement = slider.lazyEndPosition.fsubtract(currCursorPosition);

        if (lazyMovement.flength() < currMovement.flength()) {
          currMovement = lazyMovement;
        }

        currMovementLength = scalingFactor * currMovement.flength();
      }
      else if (currMovementObj instanceof SliderRepeat) {
        /**
         * For a slider repeat, assume a tighter movement 
         * threshold to better assess repeat sliders.
         */
        requiredMovement = StandardDifficultyHitObject.NORMALIZED_RADIUS;
      }

      if (currMovementLength > requiredMovement) {
        /**
         * This finds the positional delta from the required radius and the current position,
         * and updates the currCursorPosition accordingly, as well as rewarding distance.
         */
        const movementScale = Math.fround(
          (currMovementLength - requiredMovement) / currMovementLength,
        );

        currCursorPosition = currCursorPosition.fadd(currMovement.fscale(movementScale));
        currMovementLength *= (currMovementLength - requiredMovement) / currMovementLength;

        slider.lazyTravelDistance = Math.fround(
          slider.lazyTravelDistance + Math.fround(currMovementLength),
        );
      }

      if (i === nestedObjects.length - 1) {
        slider.lazyEndPosition = currCursorPosition;
      }
    }
  }

  private _getEndCursorPosition(hitObject: StandardHitObject): Vector2 {
    if (hitObject instanceof Slider) {
      this._computeSliderCursorPosition(hitObject);

      return hitObject.lazyEndPosition ?? hitObject.stackedStartPosition;
    }

    return hitObject.stackedStartPosition;
  }
}
