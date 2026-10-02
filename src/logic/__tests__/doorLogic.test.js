import { describe, it, expect } from 'vitest';
import {
  getWallRunLengthMm,
  validateDoorPlacement,
  snapDoorToJoint,
  MIN_CORNER_CLEARANCE_MM,
  requiresHeatedSill,
} from '../doorLogic.js';

describe('Door Placement & Snapping Logic', () => {
  const dimensions = {
    length: 4000,
    width: 3000,
    height: 2400,
    wallThickness: 100,
  };

  it('calculates wall run lengths accounting for corner lap', () => {
    expect(getWallRunLengthMm('north', dimensions)).toBe(4000);
    expect(getWallRunLengthMm('south', dimensions)).toBe(4000);
    // East/West walls sit inside corners: 3000 - 200 = 2800 mm
    expect(getWallRunLengthMm('east', dimensions)).toBe(2800);
    expect(getWallRunLengthMm('west', dimensions)).toBe(2800);
  });

  it('validates door placement within safe corner clearances', () => {
    expect(MIN_CORNER_CLEARANCE_MM).toBe(250);
    const validDoor = {
      wall: 'north',
      offsetMm: 1000,
      widthMm: 900,
      heightMm: 2000,
    };
    const validation = validateDoorPlacement(validDoor, dimensions);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeNull();

    // Door too close to left corner
    const tooCloseDoor = { ...validDoor, offsetMm: 50 };
    const invalidLeft = validateDoorPlacement(tooCloseDoor, dimensions);
    expect(invalidLeft.isValid).toBe(false);
    expect(invalidLeft.error).toContain('Too close to corner');

    // Door exceeding right corner (4000 - 900 - 250 = 2850 mm max safe offset)
    const exceedDoor = { ...validDoor, offsetMm: 3100 };
    const invalidRight = validateDoorPlacement(exceedDoor, dimensions);
    expect(invalidRight.isValid).toBe(false);
    expect(invalidRight.error).toContain('exceeds wall boundaries');
  });

  it('snaps door offset to the nearest modular panel joint (1000 mm intervals)', () => {
    // Offset requested at 1120 mm should snap to 1000 mm
    const snapped1 = snapDoorToJoint(1120, 'north', dimensions, 900, 1000);
    expect(snapped1).toBe(1000);

    // Offset requested at 1890 mm should snap to 2000 mm
    const snapped2 = snapDoorToJoint(1890, 'north', dimensions, 900, 1000);
    expect(snapped2).toBe(2000);
  });

  it('keeps the door start edge on a valid panel joint and rejects walls without one', () => {
    expect(snapDoorToJoint(1120, 'north', dimensions, 900, 1000)).toBe(1000);
    expect(snapDoorToJoint(500, 'north', dimensions, 3500, 1000)).toBeNull();
  });

  it('rejects overlapping doors on the same wall', () => {
    const existingDoor = { id: 'door-1', wall: 'north', offsetMm: 1000, widthMm: 900 };
    const overlappingDoor = { id: 'door-2', wall: 'north', offsetMm: 1000, widthMm: 900 };
    const separateDoor = { id: 'door-2', wall: 'north', offsetMm: 2000, widthMm: 900 };

    expect(validateDoorPlacement(overlappingDoor, dimensions, [existingDoor]).error)
      .toBe('Door overlaps another door.');
    expect(validateDoorPlacement(separateDoor, dimensions, [existingDoor]).isValid).toBe(true);
  });

  it('enables a heated sill at or below freezing', () => {
    expect(requiresHeatedSill(0)).toBe(true);
    expect(requiresHeatedSill(-18)).toBe(true);
    expect(requiresHeatedSill(1)).toBe(false);
  });
});
