/** WCAG 2.x contrast helpers. Pure, no dependencies. Colours are "#rrggbb". */

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Reads `--name: #rrggbb;` declarations from the two theme blocks of globals.css:
 * the block whose selector starts with `:root, :root[data-theme="dark"]` (dark, the default)
 * and the block `:root[data-theme="light"]`. Used only by the contrast test, so the CSS stays
 * the single source of truth for the palette.
 */
export function readThemeTokens(css: string): { dark: Record<string, string>; light: Record<string, string> } {
  function block(selectorStart: string): Record<string, string> {
    const start = css.indexOf(selectorStart);
    if (start < 0) throw new Error(`Selector not found in CSS: ${selectorStart}`);
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    const body = css.slice(open + 1, close);
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
    return out;
  }
  return { dark: block(':root, :root[data-theme="dark"]'), light: block(':root[data-theme="light"]') };
}
