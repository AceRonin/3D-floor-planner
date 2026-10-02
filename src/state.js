/**
 * Central State Management (Single Source of Truth)
 * The room configuration is strictly stored as a plain JSON object with dimensions in mm.
 */

export const DIMENSION_LIMITS = {
  length: { min: 1500, max: 20000, step: 100, default: 4000 },
  width: { min: 1500, max: 20000, step: 100, default: 3000 },
  height: { min: 2000, max: 6000, step: 100, default: 2400 },
};

export const THICKNESS_OPTIONS = [75, 100, 125, 150];
export const ROOM_TEMPERATURE_RANGE_C = { min: -18, max: 0, step: 1 };

export const DEFAULT_ROOM_CONFIG = {
  id: 'cold-room-01',
  name: 'Standard Cold Room',
  dimensions: {
    length: DIMENSION_LIMITS.length.default,
    width: DIMENSION_LIMITS.width.default,
    height: DIMENSION_LIMITS.height.default,
    wallThickness: 100,
  },
  hasInsulatedFloor: false, // Default civil concrete slab (common in Malaysia)
  targetTemperatureC: 0,
  doors: [
    {
      id: 'door-1',
      wall: 'north',
      offsetMm: 1000,
      widthMm: 900,
      heightMm: 2000,
      doorType: 'hinged',
      hingeSide: 'left',
      swingDirection: 'out',
    },
  ],
  equipment: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_VIEW_SETTINGS = {
  showCeiling: false, // Default false so interior is visible immediately
  showGrid: true,
  showWireframe: false,
  showDimensions: true,
  showWallXray: false,
  cameraPreset: 'perspective',
};

class RoomStore {
  constructor() {
    this.room = JSON.parse(JSON.stringify(DEFAULT_ROOM_CONFIG));
    this.viewSettings = { ...DEFAULT_VIEW_SETTINGS };
    this.listeners = new Set();
  }

  /**
   * Subscribe to state updates
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.listeners.add(callback);
    // Initial call
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }

  getState() {
    return {
      room: this.room,
      viewSettings: this.viewSettings,
    };
  }

  setDimension(key, value) {
    const limits = DIMENSION_LIMITS[key];
    if (!limits) return;

    const clamped = Math.max(limits.min, Math.min(limits.max, Math.round(value)));
    this.room.dimensions[key] = clamped;
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  setWallThickness(thickness) {
    if (!THICKNESS_OPTIONS.includes(thickness)) return;
    this.room.dimensions.wallThickness = thickness;
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  setHasInsulatedFloor(hasFloor) {
    this.room.hasInsulatedFloor = Boolean(hasFloor);
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  setTargetTemperatureC(value) {
    if (!Number.isFinite(value)) return;
    this.room.targetTemperatureC = Math.max(
      ROOM_TEMPERATURE_RANGE_C.min,
      Math.min(ROOM_TEMPERATURE_RANGE_C.max, Math.round(value))
    );
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  setViewSetting(key, value) {
    this.viewSettings[key] = value;
    this.notify();
  }

  toggleViewSetting(key) {
    this.viewSettings[key] = !this.viewSettings[key];
    this.notify();
  }

  setCameraPreset(preset) {
    this.viewSettings.cameraPreset = preset;
    this.notify();
  }

  setDoor(doorConfig) {
    const existingIndex = this.room.doors.findIndex((d) => d.id === doorConfig.id);
    if (existingIndex >= 0) {
      this.room.doors[existingIndex] = { ...this.room.doors[existingIndex], ...doorConfig };
    } else {
      this.room.doors.push(doorConfig);
    }
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  removeDoor(doorId) {
    this.room.doors = this.room.doors.filter((d) => d.id !== doorId);
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  setEquipment(equipmentConfig) {
    const existingIndex = this.room.equipment.findIndex((item) => item.id === equipmentConfig.id);
    if (existingIndex >= 0) {
      this.room.equipment[existingIndex] = { ...this.room.equipment[existingIndex], ...equipmentConfig };
    } else {
      this.room.equipment.push(equipmentConfig);
    }
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  removeEquipment(equipmentId) {
    this.room.equipment = this.room.equipment.filter((item) => item.id !== equipmentId);
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  addDefaultDoor() {
    this.room.doors = [
      {
        id: 'door-1',
        wall: 'north',
        offsetMm: 1000,
        widthMm: 900,
        heightMm: 2000,
        doorType: 'hinged',
        hingeSide: 'left',
        swingDirection: 'out',
      },
    ];
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  resetRoom() {
    this.room = JSON.parse(JSON.stringify(DEFAULT_ROOM_CONFIG));
    this.room.updatedAt = new Date().toISOString();
    this.notify();
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (
        parsed.dimensions &&
        typeof parsed.dimensions.length === 'number' &&
        typeof parsed.dimensions.width === 'number' &&
        typeof parsed.dimensions.height === 'number' &&
        typeof parsed.dimensions.wallThickness === 'number'
      ) {
        parsed.targetTemperatureC = Number.isFinite(parsed.targetTemperatureC)
          ? Math.max(
              ROOM_TEMPERATURE_RANGE_C.min,
              Math.min(ROOM_TEMPERATURE_RANGE_C.max, parsed.targetTemperatureC)
            )
          : DEFAULT_ROOM_CONFIG.targetTemperatureC;
        parsed.doors = Array.isArray(parsed.doors)
          ? parsed.doors.map((door, index) => ({
              ...door,
              id: door.id ?? `door-${index + 1}`,
              doorType: door.doorType === 'sliding' ? 'sliding' : 'hinged',
              hingeSide: door.hingeSide === 'right' ? 'right' : 'left',
              swingDirection: door.swingDirection === 'in' ? 'in' : 'out',
            }))
          : [];
        parsed.equipment = Array.isArray(parsed.equipment) ? parsed.equipment : [];
        this.room = parsed;
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  exportJSON() {
    return JSON.stringify(this.room, null, 2);
  }
}

export const store = new RoomStore();

