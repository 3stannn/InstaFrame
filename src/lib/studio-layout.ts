/**
 * Responsive Studio layout math.
 *
 * Viewport cards wrap into centered rows. "Fit" picks the largest scale at
 * which every wrapped row fits on screen; below MIN_FIT_SCALE the studio keeps
 * that scale and the canvas scrolls vertically instead.
 */

export const CARD_TOOLBAR_HEIGHT = 36;
export const CARD_BORDER_WIDTH = 1;
export const STUDIO_GAP = 32;
export const MIN_FIT_SCALE = 0.25;
export const MAX_FIT_SCALE = 1;

export interface ViewportSize {
  width: number;
  height: number;
}

/** Unscaled card size: viewport + toolbar + borders. */
export function cardSize(viewport: ViewportSize): ViewportSize {
  return {
    width: viewport.width + CARD_BORDER_WIDTH * 2,
    height: viewport.height + CARD_TOOLBAR_HEIGHT + CARD_BORDER_WIDTH * 2,
  };
}

/** Packs scaled cards into rows greedily, the way CSS flex-wrap does. */
export function wrapRows(cards: ViewportSize[], scale: number, availableWidth: number, gap = STUDIO_GAP) {
  const rows: { width: number; height: number; count: number }[] = [];
  for (const card of cards) {
    const w = Math.round(card.width * scale);
    const h = Math.round(card.height * scale);
    const row = rows[rows.length - 1];
    if (row && row.width + gap + w <= availableWidth) {
      row.width += gap + w;
      row.height = Math.max(row.height, h);
      row.count += 1;
    } else {
      rows.push({ width: w, height: h, count: 1 });
    }
  }
  return rows;
}

export function wrappedLayoutSize(cards: ViewportSize[], scale: number, availableWidth: number, gap = STUDIO_GAP) {
  const rows = wrapRows(cards, scale, availableWidth, gap);
  return {
    rows: rows.length,
    width: rows.reduce((max, row) => Math.max(max, row.width), 0),
    height: rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * gap,
  };
}

/**
 * Largest scale (MIN_FIT_SCALE..MAX_FIT_SCALE, 0.5% steps) at which all
 * viewports fit in the available area once wrapped into rows.
 */
export function computeFitScale(
  viewports: ViewportSize[],
  availableWidth: number,
  availableHeight: number,
  gap = STUDIO_GAP
): number {
  if (viewports.length === 0 || availableWidth <= 0 || availableHeight <= 0) return MAX_FIT_SCALE;
  const cards = viewports.map(cardSize);
  for (let step = Math.round(MAX_FIT_SCALE * 200); step >= MIN_FIT_SCALE * 200; step--) {
    const scale = step / 200;
    const size = wrappedLayoutSize(cards, scale, availableWidth, gap);
    if (size.width <= availableWidth && size.height <= availableHeight) return scale;
  }
  return MIN_FIT_SCALE;
}
