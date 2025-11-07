export const clamp = (
  value: number,
  min: number = 0,
  max: number = 1,
): number => {
  if (min > max) {
    ;[min, max] = [max, min]
  }

  return Math.max(min, Math.min(max, value))
}

export const normalize = (
  value: number,
  currentScaleMin: number,
  currentScaleMax: number,
  newScaleMin: number = 0,
  newScaleMax: number = 1,
): number => {
  const standardNormalization =
    (value - currentScaleMin) / (currentScaleMax - currentScaleMin)

  return (newScaleMax - newScaleMin) * standardNormalization + newScaleMin
}

export const clampedNormalize = (
  value: number,
  currentScaleMin: number,
  currentScaleMax: number,
  newScaleMin: number = 0,
  newScaleMax: number = 1,
): number => {
  return clamp(
    normalize(
      value,
      currentScaleMin,
      currentScaleMax,
      newScaleMin,
      newScaleMax,
    ),
    newScaleMin,
    newScaleMax,
  )
}

// In addition to _linear_ interpolation, I sometimes want to use _exponential_ interpolation, where the input is mapped onto a curved line rather than a straight one. This is beyond the scope of this lesson, but feel free to experiment with this!
export const exponentialNormalize = (
  value: number,
  currentScaleMin: number,
  currentScaleMax: number,
  newScaleMin: number = 0,
  newScaleMax: number = 1,
  exponent: number = 2,
): number => {
  const normalizedInput =
    (value - currentScaleMin) / (currentScaleMax - currentScaleMin)

  const exponentialOutput = Math.pow(normalizedInput, exponent)

  return newScaleMin + (newScaleMax - newScaleMin) * exponentialOutput
}
