import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeFitScale,
  wrapRows,
  cardSize,
  MIN_FIT_SCALE,
  STUDIO_GAP,
} from "../src/lib/studio-layout.ts";

describe("Responsive Studio wrapped layout", () => {
  test("cards wrap into a new row when the row is full", () => {
    const cards = [{ width: 400, height: 800 }, { width: 400, height: 800 }, { width: 400, height: 800 }];
    const rows = wrapRows(cards, 1, 400 * 2 + STUDIO_GAP);
    assert.deepEqual(rows.map((row) => row.count), [2, 1]);
  });

  test("fit keeps 100% when everything already fits", () => {
    assert.equal(computeFitScale([{ width: 390, height: 844 }], 2000, 2000), 1);
  });

  test("fit scales so that every wrapped row fits on screen", () => {
    const viewports = [
      { width: 393, height: 852 },
      { width: 1280, height: 832 },
      { width: 820, height: 1180 },
    ];
    const availableWidth = 1400;
    const availableHeight = 800;
    const scale = computeFitScale(viewports, availableWidth, availableHeight);
    assert.ok(scale < 1 && scale >= MIN_FIT_SCALE);
    const rows = wrapRows(viewports.map(cardSize), scale, availableWidth);
    const height = rows.reduce((sum, row) => sum + row.height, 0) + (rows.length - 1) * STUDIO_GAP;
    assert.ok(height <= availableHeight, `layout height ${height} exceeds ${availableHeight}`);
    assert.ok(rows.every((row) => row.width <= availableWidth));
  });

  test("fit picks a wrapped layout when it allows a larger scale than one row", () => {
    // Four phones on a tall, narrow canvas: two rows beat one long strip.
    const phone = { width: 393, height: 852 };
    const scale = computeFitScale([phone, phone, phone, phone], 900, 1800);
    const singleRowScale = (900 - 3 * STUDIO_GAP) / (4 * cardSize(phone).width);
    assert.ok(scale > singleRowScale, `expected ${scale} > ${singleRowScale}`);
  });

  test("fit never goes below the minimum scale; the canvas scrolls instead", () => {
    const many = Array.from({ length: 40 }, () => ({ width: 1920, height: 1080 }));
    assert.equal(computeFitScale(many, 1200, 700), MIN_FIT_SCALE);
  });
});
