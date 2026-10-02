import { describe, expect, it } from 'vitest';
import { getEquipmentFootprintMm, validateEquipmentPlacement } from '../equipmentLogic.js';

const room = {
  dimensions: { length: 4000, width: 3000, height: 2400, wallThickness: 100 },
  hasInsulatedFloor: false,
};

const pallet = {
  id: 'pallet-1',
  mountType: 'floor',
  positionMm: { x: 0, y: 75, z: 0 },
  sizeMm: { width: 1200, depth: 1000, height: 150 },
  rotationYDeg: 0,
};

describe('equipment placement logic', () => {
  it('swaps the footprint for quarter-turn rotations', () => {
    expect(getEquipmentFootprintMm({ ...pallet, rotationYDeg: 90 })).toEqual({
      widthMm: 1000,
      depthMm: 1200,
    });
  });

  it('accepts a floor item within the room', () => {
    expect(validateEquipmentPlacement(pallet, room).isValid).toBe(true);
  });

  it('rejects items outside the room and above the usable height', () => {
    expect(validateEquipmentPlacement({
      ...pallet,
      positionMm: { ...pallet.positionMm, x: 1800 },
    }, room).error).toBe('Equipment exceeds the room length.');
    expect(validateEquipmentPlacement({
      ...pallet,
      positionMm: { ...pallet.positionMm, y: 2300 },
    }, room).error).toBe('Equipment exceeds the usable room height.');
  });

  it('rejects collisions but allows edge-touching items', () => {
    const touching = {
      ...pallet,
      id: 'pallet-2',
      positionMm: { x: 1200, y: 75, z: 0 },
    };
    const overlapping = {
      ...touching,
      positionMm: { x: 1000, y: 75, z: 0 },
    };
    expect(validateEquipmentPlacement(touching, room, [pallet]).isValid).toBe(true);
    expect(validateEquipmentPlacement(overlapping, room, [pallet]).error)
      .toBe('Equipment overlaps another item.');
  });

  it('requires wall-mounted equipment to touch its selected wall', () => {
    const evaporator = {
      id: 'evaporator-1',
      mountType: 'wall',
      mountWall: 'north',
      positionMm: { x: 0, y: 1400, z: 1175 },
      sizeMm: { width: 1000, depth: 450, height: 400 },
      rotationYDeg: 0,
    };
    expect(validateEquipmentPlacement(evaporator, room).isValid).toBe(true);
    expect(validateEquipmentPlacement({
      ...evaporator,
      positionMm: { ...evaporator.positionMm, z: 1000 },
    }, room).error).toBe('Wall equipment must sit against its selected wall.');
  });
});