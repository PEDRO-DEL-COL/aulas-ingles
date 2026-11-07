import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { brandColors } from './brand'

type Key = keyof typeof brandColors

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = c.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function ratio(a: Key, b: Key) {
  const x = luminance(brandColors[a])
  const y = luminance(brandColors[b])
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

describe('paleta da marca', () => {
  it('index.css espelha brandColors', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf-8')
    for (const [name, value] of Object.entries(brandColors)) {
      expect(css.toLowerCase()).toContain(`${name}: ${value.toLowerCase()};`)
    }
  })

  it.each<[Key, Key]>([
    ['--foreground', '--background'],
    ['--foreground', '--card'],
    ['--muted-foreground', '--background'],
    ['--muted-foreground', '--muted'],
    ['--muted-foreground', '--secondary'],
    ['--primary-foreground', '--primary'],
    ['--primary', '--background'],
    ['--foreground', '--accent'],
    ['--peach-text', '--background'],
    ['--peach-text', '--peach'],
    ['--sage-text', '--secondary'],
    ['--success-foreground', '--success'],
    ['--warning', '--warning-soft'],
    ['--destructive-foreground', '--destructive'],
  ])('contraste AA: %s sobre %s', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
})
