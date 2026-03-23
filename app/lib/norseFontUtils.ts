/**
 * Norse font utilities — identification of glyphs with enclosures (holes) from outline structure.
 * Used so we can treat "hollow" letters differently (e.g. dim counter particles).
 */

import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'

type FontData = {
  resolution: number
  boundingBox: { yMin: number; yMax: number; underlineThickness?: number }
  glyphs: Record<string, { o?: string; ha: number }>
}

/**
 * Typeface JSON glyph: has an "o" (outline) string of space-separated commands (m, l, q, b, …).
 * Each "m" (moveTo) starts a new subpath. More than one subpath => glyph has at least one hole.
 */
export function getHollowGlyphSet(font: Font): Set<string> {
  const hollow = new Set<string>()
  const data = (font as unknown as { data?: FontData }).data
  const glyphs = data?.glyphs
  if (!glyphs) return hollow

  for (const char of Object.keys(glyphs)) {
    const outline = glyphs[char].o
    if (!outline || typeof outline !== 'string') continue
    const tokens = outline.trim().split(/\s+/)
    const moveCount = tokens.filter((t) => t === 'm').length
    if (moveCount > 1) hollow.add(char)
  }

  return hollow
}

export interface CharLayoutInfo {
  char: string
  x: number
  y: number
}

/**
 * Compute (x, y) layout position for each character in the given lines,
 * matching Three.js Font layout: line 1 at y=0, line 2 centered under line 1, with lineGap.
 * Supports one or two non-empty lines.
 */
export function getLayoutCharInfos(
  font: Font,
  lines: readonly string[],
  fontSize: number,
  lineGap: number
): CharLayoutInfo[] {
  const data = (font as unknown as { data?: FontData }).data
  if (!data?.glyphs) return []

  const filtered = lines.filter((l) => l.length > 0)
  if (filtered.length === 0) return []

  const scale = fontSize / data.resolution
  const lineHeight =
    (data.boundingBox.yMax - data.boundingBox.yMin + (data.boundingBox.underlineThickness ?? 0)) *
    scale
  const glyphs = data.glyphs
  const fallback = glyphs['?'] ?? { ha: 0 }

  function lineWidth(line: string): number {
    let w = 0
    for (const char of line) {
      const g = glyphs[char] ?? fallback
      w += g.ha * scale
    }
    return w
  }

  const w1 = lineWidth(filtered[0])
  const refCenterX = w1 / 2
  const w2 = filtered[1] ? lineWidth(filtered[1]) : 0
  const startX2 = filtered[1] ? refCenterX - w2 / 2 : 0

  const out: CharLayoutInfo[] = []
  let y = 0
  filtered.forEach((line, lineIndex) => {
    let x = lineIndex === 0 ? 0 : startX2
    for (const char of line) {
      out.push({ char, x, y })
      const g = glyphs[char] ?? fallback
      x += g.ha * scale
    }
    y -= lineHeight + lineGap
  })

  return out
}
