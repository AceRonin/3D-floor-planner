export const EQUIPMENT_CATALOG_STORAGE_KEY = 'cold-room-equipment-catalog-v1';

export const DEFAULT_EQUIPMENT_PRODUCTS = [
  {
    id: 'pallet-placeholder',
    name: 'Pallet',
    brand: 'Placeholder',
    mountType: 'floor',
    sizeMm: { width: 1200, depth: 1000, height: 150 },
    color: '#d97706',
    modelSource: 'box',
    active: true,
  },
  {
    id: 'evaporator-placeholder',
    name: 'Evaporator',
    brand: 'Placeholder',
    mountType: 'wall',
    sizeMm: { width: 1000, depth: 450, height: 400 },
    color: '#38bdf8',
    modelSource: 'box',
    active: true,
  },
];

export function isValidEquipmentProduct(product) {
  return Boolean(
    product &&
    typeof product.name === 'string' && product.name.trim() &&
    typeof product.brand === 'string' && product.brand.trim() &&
    (product.mountType === 'floor' || product.mountType === 'wall') &&
    product.sizeMm &&
    Number.isFinite(product.sizeMm.width) && product.sizeMm.width > 0 &&
    Number.isFinite(product.sizeMm.depth) && product.sizeMm.depth > 0 &&
    Number.isFinite(product.sizeMm.height) && product.sizeMm.height > 0 &&
    /^#[0-9a-fA-F]{6}$/.test(product.color)
  );
}

export class EquipmentCatalogStore {
  constructor(storage = undefined) {
    this.listeners = new Set();
    if (storage !== undefined) {
      this.storage = storage;
    } else {
      try {
        this.storage = globalThis.localStorage ?? null;
      } catch {
        this.storage = null;
      }
    }
    this.products = this.loadProducts();
  }

  loadProducts() {
    try {
      const saved = this.storage?.getItem(EQUIPMENT_CATALOG_STORAGE_KEY);
      if (!saved) return DEFAULT_EQUIPMENT_PRODUCTS.map((product) => ({ ...product, sizeMm: { ...product.sizeMm } }));
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Catalog data must be an array.');
      const savedIds = new Set(parsed.map((product) => product.id));
      const missingDefaults = DEFAULT_EQUIPMENT_PRODUCTS
        .filter((product) => !savedIds.has(product.id))
        .map((product) => ({ ...product, sizeMm: { ...product.sizeMm } }));
      return [...missingDefaults, ...parsed.filter(isValidEquipmentProduct)];
    } catch {
      return DEFAULT_EQUIPMENT_PRODUCTS.map((product) => ({ ...product, sizeMm: { ...product.sizeMm } }));
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getProducts());
    return () => this.listeners.delete(listener);
  }

  getProducts() {
    return this.products.map((product) => ({ ...product, sizeMm: { ...product.sizeMm } }));
  }

  saveProduct(product) {
    if (!isValidEquipmentProduct(product)) return false;
    const normalized = {
      ...product,
      name: product.name.trim(),
      brand: product.brand.trim(),
      sizeMm: { ...product.sizeMm },
      modelSource: product.modelSource ?? 'box',
      active: product.active !== false,
    };
    const index = this.products.findIndex((item) => item.id === normalized.id);
    if (index < 0) this.products.push(normalized);
    else this.products[index] = normalized;
    this.persistAndNotify();
    return true;
  }

  setProductActive(productId, active) {
    const product = this.products.find((item) => item.id === productId);
    if (!product) return false;
    product.active = Boolean(active);
    this.persistAndNotify();
    return true;
  }

  persistAndNotify() {
    try {
      this.storage?.setItem(EQUIPMENT_CATALOG_STORAGE_KEY, JSON.stringify(this.products));
    } catch {
      // The in-memory catalog remains usable when browser storage is unavailable.
    }
    const products = this.getProducts();
    this.listeners.forEach((listener) => listener(products));
  }
}

export const equipmentCatalog = new EquipmentCatalogStore();