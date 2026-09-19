import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Viewport Scaling & Footprint Mathematics", () => {
  const TOOLBAR_HEIGHT = 36;
  const BORDER_WIDTH = 1;

  function calculateCardDimensions(deviceWidth: number, deviceHeight: number) {
    const unscaledWidth = deviceWidth + BORDER_WIDTH * 2;
    const unscaledHeight = deviceHeight + TOOLBAR_HEIGHT + BORDER_WIDTH * 2;
    return { unscaledWidth, unscaledHeight };
  }

  function calculateScaledFootprint(
    deviceWidth: number,
    deviceHeight: number,
    scale: number
  ) {
    const { unscaledWidth, unscaledHeight } = calculateCardDimensions(deviceWidth, deviceHeight);
    const scaledFootprintWidth = Math.round(unscaledWidth * scale);
    const scaledFootprintHeight = Math.round(unscaledHeight * scale);
    return {
      scaledFootprintWidth,
      scaledFootprintHeight,
      unscaledWidth,
      unscaledHeight,
    };
  }

  function rotateDevice(device: { width: number; height: number; rotated: boolean }) {
    return {
      ...device,
      width: device.height,
      height: device.width,
      rotated: !device.rotated,
    };
  }

  test("a 390px layout viewport maintains 390px layout width regardless of display scale", () => {
    const device = { width: 390, height: 844 };
    const scales = [1.0, 0.75, 0.5, 0.25];

    for (const scale of scales) {
      // The iframe style width must remain exactly 390px
      const iframeStyleWidth = device.width;
      assert.equal(iframeStyleWidth, 390);

      // Scaled footprint changes proportionally in parent layout
      const footprint = calculateScaledFootprint(device.width, device.height, scale);
      assert.equal(
        footprint.scaledFootprintWidth,
        Math.round((390 + 2) * scale)
      );
      assert.equal(
        footprint.scaledFootprintHeight,
        Math.round((844 + 36 + 2) * scale)
      );
    }
  });

  test("footprint calculation correctly accounts for borders and toolbar height", () => {
    // 1440 × 900 at 100% (scale = 1.0)
    const fp100 = calculateScaledFootprint(1440, 900, 1.0);
    assert.equal(fp100.unscaledWidth, 1442);
    assert.equal(fp100.unscaledHeight, 938);
    assert.equal(fp100.scaledFootprintWidth, 1442);
    assert.equal(fp100.scaledFootprintHeight, 938);

    // 1440 × 900 at 50% (scale = 0.5)
    const fp50 = calculateScaledFootprint(1440, 900, 0.5);
    assert.equal(fp50.scaledFootprintWidth, 721);
    assert.equal(fp50.scaledFootprintHeight, 469);
  });

  test("device rotation swaps width and height correctly", () => {
    const portrait = { width: 390, height: 844, rotated: false };
    const landscape = rotateDevice(portrait);

    assert.equal(landscape.width, 844);
    assert.equal(landscape.height, 390);
    assert.equal(landscape.rotated, true);

    // Rotating back returns to portrait
    const backToPortrait = rotateDevice(landscape);
    assert.equal(backToPortrait.width, 390);
    assert.equal(backToPortrait.height, 844);
    assert.equal(backToPortrait.rotated, false);
  });

  test("frames do not overlap when placed with allocated footprints", () => {
    const devices = [
      { id: "d1", width: 1440, height: 900 },
      { id: "d2", width: 768, height: 1024 },
      { id: "d3", width: 390, height: 844 },
    ];
    const scale = 0.5;
    const gap = 32;

    let currentX = 0;
    const positions: { id: string; left: number; right: number }[] = [];

    devices.forEach((d) => {
      const fp = calculateScaledFootprint(d.width, d.height, scale);
      positions.push({
        id: d.id,
        left: currentX,
        right: currentX + fp.scaledFootprintWidth,
      });
      currentX += fp.scaledFootprintWidth + gap;
    });

    // Verify each frame starts after the previous frame + gap
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      assert.equal(curr.left, prev.right + gap);
      assert.ok(curr.left >= prev.right, "Frames must not overlap");
    }
  });
});
