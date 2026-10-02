/**
 * Pure domain logic for Cold Room dimensional calculations.
 * All spatial state is kept in millimetres (mm).
 * Three.js units are mapped with MM_TO_METERS (1 unit = 1 meter).
 */

export const MM_TO_METERS = 0.001;

export function mmToM(mm) {
  return mm * MM_TO_METERS;
}

export function mToMm(m) {
  return Math.round(m / MM_TO_METERS);
}

/**
 * Calculates internal usable dimensions by deducting panel thicknesses.
 * @param {{ length: number, width: number, height: number, wallThickness: number }} dims
 * @param {boolean} hasInsulatedFloor
 * @returns {{ lengthMm: number, widthMm: number, heightMm: number }}
 */
export function getInternalDimensions(dims, hasInsulatedFloor) {
  const doubleThickness = dims.wallThickness * 2;
  const floorDeduction = hasInsulatedFloor ? dims.wallThickness : 0;
  const ceilingDeduction = dims.wallThickness;

  return {
    lengthMm: Math.max(0, dims.length - doubleThickness),
    widthMm: Math.max(0, dims.width - doubleThickness),
    heightMm: Math.max(0, dims.height - floorDeduction - ceilingDeduction),
  };
}

/**
 * Usable floor area in square meters (m²)
 */
export function calculateFloorAreaM2(lengthMm, widthMm) {
  return (lengthMm * MM_TO_METERS) * (widthMm * MM_TO_METERS);
}

/**
 * Usable volume in cubic meters (m³)
 */
export function calculateVolumeM3(lengthMm, widthMm, heightMm) {
  return (
    (lengthMm * MM_TO_METERS) *
    (widthMm * MM_TO_METERS) *
    (heightMm * MM_TO_METERS)
  );
}

/**
 * Formats a number with fixed decimal places and locale commas.
 */
export function formatDecimals(val, decimals = 2) {
  return val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

