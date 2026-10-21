import { describe, expect, it } from 'vitest'
import { computeLayout, MAX_ASPECT, MIN_ASPECT, MIN_UI_SCALE } from '../src/layout'

describe('computeLayout', () => {
  it('fills a 16:9 screen at the design scale', () => {
    expect(computeLayout({ width: 1280, height: 720 })).toEqual({ x: 0, y: 0, width: 1280, height: 720, uiScale: 1 })
  })

  it('fills screens between 4:3 and 21:9 without letterboxing', () => {
    for (const size of [
      { width: 1024, height: 768 },
      { width: 2340, height: 1080 },
      { width: 1920, height: 1080 },
    ]) {
      const layout = computeLayout(size)
      expect(layout.width).toBe(size.width)
      expect(layout.height).toBe(size.height)
    }
  })

  it('letterboxes the sides beyond 21:9', () => {
    const layout = computeLayout({ width: 3440, height: 1080 })
    expect(layout.height).toBe(1080)
    expect(layout.width).toBeCloseTo(1080 * MAX_ASPECT)
    expect(layout.x).toBeCloseTo((3440 - 1080 * MAX_ASPECT) / 2)
    expect(layout.y).toBe(0)
  })

  it('letterboxes top and bottom below 4:3, including portrait', () => {
    const layout = computeLayout({ width: 768, height: 1024 })
    expect(layout.width).toBe(768)
    expect(layout.height).toBeCloseTo(768 / MIN_ASPECT)
    expect(layout.x).toBe(0)
    expect(layout.y).toBeCloseTo((1024 - 768 / MIN_ASPECT) / 2)
  })

  it('scales the UI up by the tighter of width and height', () => {
    expect(computeLayout({ width: 2560, height: 1080 }).uiScale).toBeCloseTo(1.5)
    expect(computeLayout({ width: 1920, height: 1080 }).uiScale).toBeCloseTo(1.5)
  })

  it('never shrinks the UI below its design size, so phones stay readable', () => {
    expect(computeLayout({ width: 1024, height: 768 }).uiScale).toBe(MIN_UI_SCALE)
    expect(computeLayout({ width: 780, height: 360 }).uiScale).toBe(MIN_UI_SCALE)
    expect(computeLayout({ width: 400, height: 200 }).uiScale).toBe(MIN_UI_SCALE)
  })
})
