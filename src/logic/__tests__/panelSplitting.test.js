import { describe, it, expect } from 'vitest';
import {
  splitSpanIntoPanels,
  calculateRoomPanels,
  STANDARD_PANEL_WIDTH_MM,
} from '../panelSplitting.js';

describe('Modular Panel Splitting Logic', () => {
  it('correctly splits an exact multiple into standard 1000mm panels', () => {
    const result = splitSpanIntoPanels(4000, 1000);
    expect(result.fullCount).toBe(4);
    expect(result.cutWidthMm).toBe(0);
    expect(result.panels.length).toBe(4);

    expect(result.panels[0]).toEqual({ index: 0, widthMm: 1000, isCut: false, offsetMm: 0 });
    expect(result.panels[3]).toEqual({ index: 3, widthMm: 1000, isCut: false, offsetMm: 3000 });
  });

  it('correctly identifies end cut panel for non-multiples', () => {
    const result = splitSpanIntoPanels(4350, 1000);
    expect(result.fullCount).toBe(4);
    expect(result.cutWidthMm).toBe(350);
    expect(result.panels.length).toBe(5);

    // 4th panel is full
    expect(result.panels[3]).toEqual({ index: 3, widthMm: 1000, isCut: false, offsetMm: 3000 });
    // 5th panel is cut
    expect(result.panels[4]).toEqual({ index: 4, widthMm: 350, isCut: true, offsetMm: 4000 });
  });

  it('handles span smaller than standard panel width', () => {
    const result = splitSpanIntoPanels(650, 1000);
    expect(result.fullCount).toBe(0);
    expect(result.cutWidthMm).toBe(650);
    expect(result.panels.length).toBe(1);
    expect(result.panels[0]).toEqual({ index: 0, widthMm: 650, isCut: true, offsetMm: 0 });
  });

  it('calculates room panels and corner deductions for a 4000 × 3000 × 2400 mm room', () => {
    const roomConfig = {
      dimensions: {
        length: 4000,
        width: 3000,
        height: 2400,
        wallThickness: 100,
      },
      hasInsulatedFloor: false, // Concrete floor
    };

    const breakdown = calculateRoomPanels(roomConfig);

    // Wall Height: 2400 - 100 (ceiling) = 2300 mm
    expect(breakdown.wallHeightMm).toBe(2300);

    // North Wall: 4000 mm -> 4 full panels
    expect(breakdown.northWall.fullCount).toBe(4);
    expect(breakdown.northWall.cutWidthMm).toBe(0);

    // South Wall: 4000 mm -> 4 full panels
    expect(breakdown.southWall.fullCount).toBe(4);
    expect(breakdown.southWall.cutWidthMm).toBe(0);

    // East Wall: 3000 - 200 = 2800 mm -> 2 full panels + 1 cut panel (800mm)
    expect(breakdown.eastWall.fullCount).toBe(2);
    expect(breakdown.eastWall.cutWidthMm).toBe(800);

    // West Wall: 3000 - 200 = 2800 mm -> 2 full panels + 1 cut panel (800mm)
    expect(breakdown.westWall.fullCount).toBe(2);
    expect(breakdown.westWall.cutWidthMm).toBe(800);

    // Ceiling: 4000 mm length -> 4 full panels (spanning 3000 mm width)
    expect(breakdown.ceiling.fullCount).toBe(4);
    expect(breakdown.ceiling.cutWidthMm).toBe(0);

    // Summary totals:
    // Full: 4 (north) + 4 (south) + 2 (east) + 2 (west) + 4 (ceiling) = 16 full panels
    // Cut: 1 (east) + 1 (west) = 2 cut panels
    expect(breakdown.summary.totalFullPanels).toBe(16);
    expect(breakdown.summary.totalCutPanels).toBe(2);
    expect(breakdown.summary.totalPanels).toBe(18);
    expect(breakdown.summary.cutList.length).toBe(2);
    expect(breakdown.summary.cutList[0].widthMm).toBe(800);
  });
});
