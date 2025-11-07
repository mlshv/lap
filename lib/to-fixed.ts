export function toFixed(number: number | string, precision: number = 5) {
  const num = Number(number)
  const result = num.toFixed(precision)
  const resultWithoutTrailingZeros = result.replace(/\.?0+$/, '')

  return resultWithoutTrailingZeros
}
