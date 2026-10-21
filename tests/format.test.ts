import { describe, expect, it } from 'vitest'
import { formatDuration, formatNumber } from '../src/ui/format'

describe('format', () => {
  it('formats durations compactly, rounding up', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(44_100)).toBe('45s')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
    expect(formatDuration(-5)).toBe('0s')
  })

  it('groups thousands', () => {
    expect(formatNumber(1240)).toBe('1,240')
  })
})
