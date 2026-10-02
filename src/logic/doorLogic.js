/**
 * Pure domain logic for cold room door placement, joint snapping, and collision validation.
 * Zero Three.js or DOM dependencies.
 */

export const MIN_CORNER_CLEARANCE_MM = 250;

export const DOOR_PRESETS = [
  { id: 'standard', name: 'Standard 900 × 2000 mm', widthMm: 900, heightMm: 2000 },
  { id: 'wide', name: 'Wide 1200 × 2100 mm', widthMm: 1200, heightMm: 2100 },
];

export function requiresHeatedSill(targetTemperatureC) {
  return targetTemperatureC <= 0;
}

/**
 * Returns usable run length for a given wall in mm.
 * - North/South: run = length
 * - East/West: run = width - 2 * wallThickness
 */
export function getWallRunLengthMm(wall, dimensions) {
  if (wall === 'north' || wall === 'south') {
    return dimensions.length;
  }
  return Math.max(0, dimensions.width - 2 * dimensions.wallThickness);
}

/**
 * Validates door placement against corners and wall boundaries.
 * @param {Object} door - { id, wall, offsetMm, widthMm, heightMm }
 * @param {Object} dimensions - Room dimensions in mm
 * @param {Array} existingDoors - Doors to check for overlap on the same wall
 * @returns {{ isValid: boolean, error: string | null, minOffsetMm: number, maxOffsetMm: number }}
 */
export function validateDoorPlacement(door, dimensions, existingDoors = []) {
  const wallRun = getWallRunLengthMm(door.wall, dimensions);

  // Clearance from left and right corners
  const minOffsetMm = MIN_CORNER_CLEARANCE_MM;
  const maxOffsetMm = wallRun - door.widthMm - MIN_CORNER_CLEARANCE_MM;

  if (door.offsetMm < minOffsetMm) {
    return {
      isValid: false,
      error: `Too close to corner. Min clearance is ${MIN_CORNER_CLEARANCE_MM} mm.`,
      minOffsetMm,
      maxOffsetMm,
    };
  }

  if (maxOffsetMm < minOffsetMm || door.offsetMm > maxOffsetMm) {
    return {
      isValid: false,
      error: `Door exceeds wall boundaries. Max offset is ${maxOffsetMm} mm.`,
      minOffsetMm,
      maxOffsetMm,
    };
  }

  const overlapsDoor = existingDoors.some((existingDoor) => {
    if (existingDoor.id === door.id || existingDoor.wall !== door.wall) return false;
    return door.offsetMm < existingDoor.offsetMm + existingDoor.widthMm &&
      door.offsetMm + door.widthMm > existingDoor.offsetMm;
  });
  if (overlapsDoor) {
    return {
      isValid: false,
      error: 'Door overlaps another door.',
      minOffsetMm,
      maxOffsetMm,
    };
  }

  return {
    isValid: true,
    error: null,
    minOffsetMm,
    maxOffsetMm,
  };
}

/**
 * Snaps a door offset to the nearest modular panel joint.
 * Standard panel width: 1000 mm.
 * @param {number} requestedOffsetMm
 * @param {string} wall
 * @param {Object} dimensions
 * @param {number} doorWidthMm
 * @param {number} standardPanelWidthMm
 * @returns {number} Snapped and validated offset in mm
 */
export function snapDoorToJoint(
  requestedOffsetMm,
  wall,
  dimensions,
  doorWidthMm = 900,
  standardPanelWidthMm = 1000
) {
  const wallRun = getWallRunLengthMm(wall, dimensions);
  const minOffset = MIN_CORNER_CLEARANCE_MM;
  const maxOffset = wallRun - doorWidthMm - MIN_CORNER_CLEARANCE_MM;
  if (maxOffset < minOffset) return null;

  // Generate valid panel joint snap positions along the wall
  const snapPoints = [];
  for (let pos = standardPanelWidthMm; pos < wallRun; pos += standardPanelWidthMm) {
    if (pos >= minOffset && pos <= maxOffset) {
      snapPoints.push(pos);
    }
  }

  if (snapPoints.length === 0) return null;

  // Find nearest snap point
  let closestPoint = snapPoints[0];
  let minDiff = Math.abs(requestedOffsetMm - closestPoint);

  for (const point of snapPoints) {
    const diff = Math.abs(requestedOffsetMm - point);
    if (diff < minDiff) {
      minDiff = diff;
      closestPoint = point;
    }
  }

  return closestPoint;
}
