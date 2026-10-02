import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EQUIPMENT_PRODUCTS,
  EquipmentCatalogStore,
  isValidEquipmentProduct,
} from '../../catalog/equipmentCatalog.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('equipment catalog', () => {
  it('starts with the pallet and evaporator placeholder products', () => {
    const catalog = new EquipmentCatalogStore(createMemoryStorage());
    expect(catalog.getProducts().map((product) => product.name)).toEqual(['Pallet', 'Evaporator']);
  });

  it('validates product dimensions and editable metadata', () => {
    expect(isValidEquipmentProduct(DEFAULT_EQUIPMENT_PRODUCTS[0])).toBe(true);
    expect(isValidEquipmentProduct({
      ...DEFAULT_EQUIPMENT_PRODUCTS[0],
      sizeMm: { ...DEFAULT_EQUIPMENT_PRODUCTS[0].sizeMm, width: 0 },
    })).toBe(false);
  });

  it('persists products and archives/restores them without deleting the record', () => {
    const storage = createMemoryStorage();
    const catalog = new EquipmentCatalogStore(storage);
    const customProduct = {
      id: 'custom-rack',
      name: 'Rack',
      brand: 'Local Supplier',
      mountType: 'floor',
      sizeMm: { width: 1100, depth: 900, height: 1800 },
      color: '#64748b',
      modelSource: 'box',
      active: true,
    };

    expect(catalog.saveProduct(customProduct)).toBe(true);
    expect(catalog.setProductActive(customProduct.id, false)).toBe(true);

    const restoredFromStorage = new EquipmentCatalogStore(storage);
    expect(restoredFromStorage.getProducts().find((product) => product.id === customProduct.id).active)
      .toBe(false);
    expect(restoredFromStorage.setProductActive(customProduct.id, true)).toBe(true);
    expect(restoredFromStorage.getProducts().find((product) => product.id === customProduct.id).active)
      .toBe(true);
  });
});