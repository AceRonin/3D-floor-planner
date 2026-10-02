import { describe, it, expect } from 'vitest';
import {
  mmToM,
  mToMm,
  getInternalDimensions,
  calculateFloorAreaM2,
  calculateVolumeM3,
} from '../calculations.js';

describe('Vanilla JS Room Calculations', () => {
  it('converts mm to meters and back accurately', () => {
    expect(mmToM(4000)).toBe(4.0);
    expect(mmToM(100)).toBe(0.1);
    expect(mToMm(4.0)).toBe(4000);
  });

  it('calculates usable internal dimensions for concrete slab (uninsulated floor)', () => {
    const dims = { length: 4000, width: 3000, height: 2400, wallThickness: 100 };
    const internal = getInternalDimensions(dims, false);

    // Length: 4000 - 200 = 3800
    expect(internal.lengthMm).toBe(3800);
    // Width: 3000 - 200 = 2800
    expect(internal.widthMm).toBe(2800);
    // Height: 2400 - 100 (ceiling only) = 2300
    expect(internal.heightMm).toBe(2300);
  });

  it('calculates usable internal dimensions for insulated floor', () => {
    const dims = { length: 4000, width: 3000, height: 2400, wallThickness: 100 };
    const internal = getInternalDimensions(dims, true);

    // Height: 2400 - 100 (ceiling) - 100 (floor) = 2200
    expect(internal.heightMm).toBe(2200);
  });

  it('calculates usable floor area and volume', () => {
    const area = calculateFloorAreaM2(3800, 2800);
    expect(area).toBeCloseTo(10.64, 2);

    const volume = calculateVolumeM3(3800, 2800, 2300);
    expect(volume).toBeCloseTo(24.472, 3);
  });
});
