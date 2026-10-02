/**
 * Pure domain logic for modular panel splitting and counting.
 * Cold storage walls and ceilings are built from standard modular sandwich panels.
 * Zero Three.js or DOM dependencies.
 */

export const STANDARD_PANEL_WIDTH_MM = 1000;

/**
 * Splits a straight linear run (in mm) into standard panels and an optional cut panel.
 * @param {number} spanMm - Total run length in mm
 * @param {number} standardWidthMm - Standard panel width (default 1000mm)
 * @returns {{
 *   spanMm: number,
 *   fullCount: number,
 *   cutWidthMm: number,
 *   panels: Array<{ index: number, widthMm: number, isCut: boolean, offsetMm: number }>
 * }}
 */
export function splitSpanIntoPanels(spanMm, standardWidthMm = STANDARD_PANEL_WIDTH_MM) {
  if (spanMm <= 0) {
    return { spanMm: 0, fullCount: 0, cutWidthMm: 0, panels: [] };
  }

  const fullCount = Math.floor(spanMm / standardWidthMm);
  const cutWidthMm = spanMm % standardWidthMm;

  const panels = [];
  let currentOffset = 0;

  // Full standard panels
  for (let i = 0; i < fullCount; i++) {
    panels.push({
      index: i,
      widthMm: standardWidthMm,
      isCut: false,
      offsetMm: currentOffset,
    });
    currentOffset += standardWidthMm;
  }

  // End cut panel (if run does not divide evenly)
  if (cutWidthMm > 0) {
    panels.push({
      index: fullCount,
      widthMm: cutWidthMm,
      isCut: true,
      offsetMm: currentOffset,
    });
  }

  return {
    spanMm,
    fullCount,
    cutWidthMm,
    panels,
  };
}

/**
 * Calculates complete modular panel breakdown for the 4 walls, ceiling, and optional floor.
 * 
 * Corner joint rule:
 * - North (+Z) and South (-Z) walls run the full external length.
 * - East (+X) and West (-X) walls butt inside: span = width - 2 * wallThickness.
 * - Ceiling panels span across the room (width) in modular 1000mm segments along length.
 * 
 * @param {Object} roomConfig
 * @param {number} standardWidthMm
 * @returns {Object} Complete panel calculation and summary
 */
export function calculateRoomPanels(roomConfig, standardWidthMm = STANDARD_PANEL_WIDTH_MM) {
  const { length, width, height, wallThickness } = roomConfig.dimensions;
  const hasInsulatedFloor = roomConfig.hasInsulatedFloor;

  // Usable wall height between floor and ceiling
  const floorThickness = hasInsulatedFloor ? wallThickness : 0;
  const ceilingThickness = wallThickness;
  const wallHeightMm = Math.max(0, height - floorThickness - ceilingThickness);

  // 1. North & South Walls (full exterior length)
  const northWall = splitSpanIntoPanels(length, standardWidthMm);
  const southWall = splitSpanIntoPanels(length, standardWidthMm);

  // 2. East & West Walls (interior fit between North & South)
  const eastWestSpanMm = Math.max(0, width - 2 * wallThickness);
  const eastWall = splitSpanIntoPanels(eastWestSpanMm, standardWidthMm);
  const westWall = splitSpanIntoPanels(eastWestSpanMm, standardWidthMm);

  // 3. Ceiling Panels (standard 1000mm modular strips spanning full width along length)
  const ceiling = splitSpanIntoPanels(length, standardWidthMm);

  // 4. Floor Panels (if insulated)
  const floor = hasInsulatedFloor ? splitSpanIntoPanels(length, standardWidthMm) : null;

  // Aggregation & Totals
  let totalFullPanels = 0;
  let totalCutPanels = 0;
  const cutList = [];

  const wallRuns = [
    { name: 'North Wall (Front)', data: northWall, heightMm: wallHeightMm, orientation: 'horizontal' },
    { name: 'South Wall (Back)', data: southWall, heightMm: wallHeightMm, orientation: 'horizontal' },
    { name: 'East Wall (Right)', data: eastWall, heightMm: wallHeightMm, orientation: 'horizontal' },
    { name: 'West Wall (Left)', data: westWall, heightMm: wallHeightMm, orientation: 'horizontal' },
  ];

  wallRuns.forEach((run) => {
    totalFullPanels += run.data.fullCount;
    if (run.data.cutWidthMm > 0) {
      totalCutPanels += 1;
      cutList.push({
        location: run.name,
        widthMm: run.data.cutWidthMm,
        heightMm: run.heightMm,
      });
    }
  });

  // Ceiling Panels
  totalFullPanels += ceiling.fullCount;
  if (ceiling.cutWidthMm > 0) {
    totalCutPanels += 1;
    cutList.push({
      location: 'Ceiling Roof',
      widthMm: ceiling.cutWidthMm,
      heightMm: width, // panel length
    });
  }

  // Floor Panels
  if (floor) {
    totalFullPanels += floor.fullCount;
    if (floor.cutWidthMm > 0) {
      totalCutPanels += 1;
      cutList.push({
        location: 'Insulated Floor',
        widthMm: floor.cutWidthMm,
        heightMm: width,
      });
    }
  }

  // Total Wall Surface Area in m²
  const wallAreaM2 = (2 * length + 2 * eastWestSpanMm) * wallHeightMm * 1e-6;
  const ceilingAreaM2 = length * width * 1e-6;
  const floorAreaM2 = hasInsulatedFloor ? length * width * 1e-6 : 0;
  const totalPanelAreaM2 = wallAreaM2 + ceilingAreaM2 + floorAreaM2;

  return {
    wallHeightMm,
    northWall,
    southWall,
    eastWall,
    westWall,
    ceiling,
    floor,
    summary: {
      totalFullPanels,
      totalCutPanels,
      totalPanels: totalFullPanels + totalCutPanels,
      totalPanelAreaM2,
      cutList,
    },
  };
}
