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
 * matching Three.js Font layout: line 1 at y=0, line 2/3 centered under line 1, with lineGap.
 */
export function getLayoutCharInfos(
  font: Font,
  lines: [string, string, string],
  fontSize: number,
  lineGap: number
): CharLayoutInfo[] {
  const data = (font as unknown as { data?: FontData }).data
  if (!data?.glyphs) return []

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

  const w1 = lineWidth(lines[0])
  const w2 = lineWidth(lines[1])
  const w3 = lineWidth(lines[2])
  const refCenterX = w1 / 2
  const startX2 = refCenterX - w2 / 2
  const startX3 = refCenterX - w3 / 2

  const out: CharLayoutInfo[] = []
  let y = 0
  ;[lines[0], lines[1], lines[2]].forEach((line, lineIndex) => {
    let x = lineIndex === 0 ? 0 : lineIndex === 1 ? startX2 : startX3
    for (const char of line) {
      out.push({ char, x, y })
      const g = glyphs[char] ?? fallback
      x += g.ha * scale
    }
    y -= lineHeight + lineGap
  })

  return out
}
