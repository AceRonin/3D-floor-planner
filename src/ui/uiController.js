import { store } from '../state.js';
import {
  calculateFloorAreaM2,
  calculateVolumeM3,
  formatDecimals,
  getInternalDimensions,
} from '../logic/calculations.js';
import { calculateRoomPanels } from '../logic/panelSplitting.js';
import { requiresHeatedSill } from '../logic/doorLogic.js';
import { getEquipmentFootprintMm, validateEquipmentPlacement } from '../logic/equipmentLogic.js';
import { equipmentCatalog } from '../catalog/equipmentCatalog.js';

export class UIController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;

    // Cache DOM Elements
    this.dom = {
      // Inputs
      lengthInput: document.getElementById('input-length'),
      lengthSlider: document.getElementById('slider-length'),
      lengthMinus: document.getElementById('btn-length-minus'),
      lengthPlus: document.getElementById('btn-length-plus'),

      widthInput: document.getElementById('input-width'),
      widthSlider: document.getElementById('slider-width'),
      widthMinus: document.getElementById('btn-width-minus'),
      widthPlus: document.getElementById('btn-width-plus'),

      heightInput: document.getElementById('input-height'),
      heightSlider: document.getElementById('slider-height'),
      heightMinus: document.getElementById('btn-height-minus'),
      heightPlus: document.getElementById('btn-height-plus'),

      // Presets
      presetBtns: document.querySelectorAll('.preset-btn'),
      thicknessBtns: document.querySelectorAll('.thickness-btn'),
      floorBtns: document.querySelectorAll('.floor-btn'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      dimensionSidebar: document.getElementById('dimension-sidebar'),
      targetTemperatureInput: document.getElementById('input-target-temperature'),
      targetTemperatureValue: document.getElementById('target-temperature-value'),
      heatedSillStatus: document.getElementById('heated-sill-status'),
      btnAddDoor: document.getElementById('btn-add-door'),
      doorPlacementStatus: document.getElementById('door-placement-status'),
      doorList: document.getElementById('door-list'),
      doorCount: document.getElementById('door-count'),
      doorFloatingControls: document.getElementById('door-floating-controls'),
      selectedDoorLabel: document.getElementById('selected-door-label'),
      doorTypeSelect: document.getElementById('door-type-select'),
      btnFlipHinge: document.getElementById('btn-flip-hinge'),
      btnFlipSwing: document.getElementById('btn-flip-swing'),
      btnNewEquipment: document.getElementById('btn-new-equipment'),
      equipmentCatalogStatus: document.getElementById('equipment-catalog-status'),
      equipmentCatalogList: document.getElementById('equipment-catalog-list'),
      equipmentProductForm: document.getElementById('equipment-product-form'),
      equipmentFormTitle: document.getElementById('equipment-form-title'),
      equipmentName: document.getElementById('equipment-name'),
      equipmentBrand: document.getElementById('equipment-brand'),
      equipmentMountType: document.getElementById('equipment-mount-type'),
      equipmentWidth: document.getElementById('equipment-width'),
      equipmentDepth: document.getElementById('equipment-depth'),
      equipmentHeight: document.getElementById('equipment-height'),
      equipmentColor: document.getElementById('equipment-color'),
      btnCancelEquipmentEdit: document.getElementById('btn-cancel-equipment-edit'),
      placedEquipmentList: document.getElementById('placed-equipment-list'),

      // Stats
      statArea: document.getElementById('stat-area'),
      statVolume: document.getElementById('stat-volume'),
      statInternal: document.getElementById('stat-internal'),

      // Modular Panel Breakdown
      panelTotalCount: document.getElementById('panel-total-count'),
      panelFullCount: document.getElementById('panel-full-count'),
      panelCutCount: document.getElementById('panel-cut-count'),
      panelTotalArea: document.getElementById('panel-total-area'),
      wbNorth: document.getElementById('wb-north'),
      wbSouth: document.getElementById('wb-south'),
      wbEast: document.getElementById('wb-east'),
      wbWest: document.getElementById('wb-west'),
      wbCeiling: document.getElementById('wb-ceiling'),
      wbFloorRow: document.getElementById('wb-floor-row'),
      wbFloor: document.getElementById('wb-floor'),
      cutListAlert: document.getElementById('cut-list-alert'),
      cutListText: document.getElementById('cut-list-text'),

      // Camera Toolbar
      cameraBtns: document.querySelectorAll('.camera-btn'),

      // View Toggles
      btnRoof: document.getElementById('btn-toggle-roof'),
      btnDimensions: document.getElementById('btn-toggle-dimensions'),
      btnGrid: document.getElementById('btn-toggle-grid'),
      btnWireframe: document.getElementById('btn-toggle-wireframe'),
      btnToggleWallXray: document.getElementById('btn-toggle-wall-xray'),

      // Header Actions
      btnReset: document.getElementById('btn-reset'),
      btnInspectJson: document.getElementById('btn-inspect-json'),
      btnInspectJsonHud: document.getElementById('btn-inspect-json-hud'),

      // Modal
      jsonModal: document.getElementById('json-modal'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      btnTabExport: document.getElementById('tab-export'),
      btnTabImport: document.getElementById('tab-import'),
      panelExport: document.getElementById('panel-export'),
      panelImport: document.getElementById('panel-import'),
      jsonPre: document.getElementById('json-display'),
      jsonTextarea: document.getElementById('json-import-textarea'),
      btnCopyJson: document.getElementById('btn-copy-json'),
      btnDownloadJson: document.getElementById('btn-download-json'),
      btnApplyJson: document.getElementById('btn-apply-json'),
      btnCancelImport: document.getElementById('btn-cancel-import'),
      importError: document.getElementById('import-error'),
    };

    this.bindEvents();
    this.selectedDoorId = null;
    this.selectedEquipmentId = null;
    this.editingEquipmentId = null;
    this.catalogProducts = equipmentCatalog.getProducts();
    this.bindDoorControls();
    this.bindEquipmentControls();
    equipmentCatalog.subscribe((products) => {
      this.catalogProducts = products;
      this.renderEquipmentCatalog();
    });
    this.sceneManager.setDoorCallbacks({
      onDoorPlaced: (door) => {
        this.sceneManager.setDoorPlacementEnabled(false);
        this.selectedDoorId = door.id;
        store.setDoor(door);
      },
      onDoorSelected: (doorId) => {
        this.selectedDoorId = doorId;
        this.update(store.getState());
      },
      onPlacementStatus: (status) => {
        if (this.dom.doorPlacementStatus) {
          this.dom.doorPlacementStatus.textContent = status.message;
          this.dom.doorPlacementStatus.classList.toggle('error', !status.valid && status.active);
        }
        if (this.dom.btnAddDoor) {
          this.dom.btnAddDoor.textContent = status.active ? 'Cancel Placement' : 'Place Door in 3D';
        }
      },
    });
    this.sceneManager.setEquipmentCallbacks({
      onEquipmentPlaced: (equipment) => {
        this.sceneManager.setEquipmentPlacementProduct(null);
        this.selectedEquipmentId = equipment.id;
        store.setEquipment(equipment);
      },
      onEquipmentSelected: (equipmentId) => {
        this.selectedEquipmentId = equipmentId;
        this.update(store.getState());
      },
      onEquipmentStatus: (status) => {
        if (this.dom.equipmentCatalogStatus) {
          this.dom.equipmentCatalogStatus.textContent = status.message;
          this.dom.equipmentCatalogStatus.classList.toggle('error', !status.valid && status.active);
        }
      },
    });
  }

  bindDoorControls() {
    if (this.dom.targetTemperatureInput) {
      this.dom.targetTemperatureInput.addEventListener('input', () => {
        store.setTargetTemperatureC(Number(this.dom.targetTemperatureInput.value));
      });
    }

    if (this.dom.btnAddDoor) {
      this.dom.btnAddDoor.addEventListener('click', () => {
        this.sceneManager.setDoorPlacementEnabled(!this.sceneManager.doorPlacementEnabled);
      });
    }

    if (this.dom.doorList) {
      this.dom.doorList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.action === 'remove') {
          store.removeDoor(button.dataset.doorId);
          if (this.selectedDoorId === button.dataset.doorId) this.selectedDoorId = null;
          return;
        }
        this.selectedDoorId = button.dataset.doorId;
        this.update(store.getState());
      });
    }

    if (this.dom.doorTypeSelect) {
      this.dom.doorTypeSelect.addEventListener('change', () => {
        this.updateSelectedDoor({ doorType: this.dom.doorTypeSelect.value });
      });
    }

    if (this.dom.btnFlipHinge) {
      this.dom.btnFlipHinge.addEventListener('click', () => {
        const door = this.getSelectedDoor();
        if (door?.doorType === 'hinged') {
          this.updateSelectedDoor({ hingeSide: door.hingeSide === 'left' ? 'right' : 'left' });
        }
      });
    }

    if (this.dom.btnFlipSwing) {
      this.dom.btnFlipSwing.addEventListener('click', () => {
        const door = this.getSelectedDoor();
        if (door?.doorType === 'hinged') {
          this.updateSelectedDoor({ swingDirection: door.swingDirection === 'out' ? 'in' : 'out' });
        }
      });
    }
  }

  getSelectedDoor() {
    return store.room.doors.find((door) => door.id === this.selectedDoorId) ?? null;
  }

  updateSelectedDoor(changes) {
    const door = this.getSelectedDoor();
    if (door) store.setDoor({ ...door, ...changes });
  }

  bindEquipmentControls() {
    if (this.dom.btnToggleSidebar && this.dom.dimensionSidebar) {
      this.dom.btnToggleSidebar.addEventListener('click', () => {
        const isOpen = this.dom.dimensionSidebar.classList.toggle('mobile-open');
        this.dom.btnToggleSidebar.setAttribute('aria-expanded', String(isOpen));
        this.dom.btnToggleSidebar.textContent = isOpen ? 'Close Controls' : 'Room Controls';
      });
    }

    if (this.dom.btnNewEquipment) {
      this.dom.btnNewEquipment.addEventListener('click', () => this.openEquipmentForm());
    }

    if (this.dom.btnCancelEquipmentEdit) {
      this.dom.btnCancelEquipmentEdit.addEventListener('click', () => this.closeEquipmentForm());
    }

    if (this.dom.equipmentProductForm) {
      this.dom.equipmentProductForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(this.dom.equipmentProductForm);
        const existing = this.catalogProducts.find((product) => product.id === this.editingEquipmentId);
        const product = {
          id: existing?.id ?? `product-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
          name: String(formData.get('name') ?? ''),
          brand: String(formData.get('brand') ?? ''),
          mountType: String(formData.get('mountType') ?? 'floor'),
          sizeMm: {
            width: Number(formData.get('width')),
            depth: Number(formData.get('depth')),
            height: Number(formData.get('height')),
          },
          color: String(formData.get('color') ?? '#94a3b8'),
          modelSource: existing?.modelSource ?? 'box',
          active: existing?.active ?? true,
        };
        if (equipmentCatalog.saveProduct(product)) {
          this.closeEquipmentForm();
          this.setEquipmentStatus(`${product.name} saved to the catalog.`, false);
        } else {
          this.setEquipmentStatus('Enter a name, brand, valid box dimensions, and color.', true);
        }
      });
    }

    if (this.dom.equipmentCatalogList) {
      this.dom.equipmentCatalogList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const product = this.catalogProducts.find((item) => item.id === button.dataset.productId);
        if (!product) return;

        if (button.dataset.action === 'place') {
          this.sceneManager.setEquipmentPlacementProduct(product);
        } else if (button.dataset.action === 'edit') {
          this.openEquipmentForm(product);
        } else if (button.dataset.action === 'archive') {
          equipmentCatalog.setProductActive(product.id, false);
          this.setEquipmentStatus(`${product.name} archived; existing room items are unchanged.`, false);
        } else if (button.dataset.action === 'restore') {
          equipmentCatalog.setProductActive(product.id, true);
          this.setEquipmentStatus(`${product.name} restored to the catalog.`, false);
        }
      });
    }

    if (this.dom.placedEquipmentList) {
      this.dom.placedEquipmentList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const equipment = store.room.equipment.find((item) => item.id === button.dataset.equipmentId);
        if (!equipment) return;

        if (button.dataset.action === 'remove') {
          store.removeEquipment(equipment.id);
          if (this.selectedEquipmentId === equipment.id) this.selectedEquipmentId = null;
        } else if (button.dataset.action === 'select') {
          this.selectedEquipmentId = equipment.id;
          this.update(store.getState());
        } else if (button.dataset.action === 'rotate') {
          const rotated = { ...equipment, rotationYDeg: (equipment.rotationYDeg + 90) % 360 };
          const footprint = getEquipmentFootprintMm(rotated);
          const { dimensions } = store.room;
          const halfRoomLength = dimensions.length / 2 - dimensions.wallThickness;
          const halfRoomWidth = dimensions.width / 2 - dimensions.wallThickness;
          if (rotated.mountType === 'wall') {
            const wallPositions = {
              north: { z: halfRoomWidth - footprint.depthMm / 2 },
              south: { z: -halfRoomWidth + footprint.depthMm / 2 },
              east: { x: halfRoomLength - footprint.widthMm / 2 },
              west: { x: -halfRoomLength + footprint.widthMm / 2 },
            };
            rotated.positionMm = { ...rotated.positionMm, ...wallPositions[rotated.mountWall] };
          }
          const otherEquipment = store.room.equipment.filter((item) => item.id !== equipment.id);
          const validation = validateEquipmentPlacement(rotated, store.room, otherEquipment);
          if (validation.isValid) store.setEquipment(rotated);
          else this.setEquipmentStatus(validation.error, true);
        }
      });
    }
  }

  openEquipmentForm(product = null) {
    this.editingEquipmentId = product?.id ?? null;
    if (this.dom.equipmentFormTitle) {
      this.dom.equipmentFormTitle.textContent = product ? 'Edit Equipment Box' : 'Add Equipment Box';
    }
    if (this.dom.equipmentName) this.dom.equipmentName.value = product?.name ?? '';
    if (this.dom.equipmentBrand) this.dom.equipmentBrand.value = product?.brand ?? '';
    if (this.dom.equipmentMountType) this.dom.equipmentMountType.value = product?.mountType ?? 'floor';
    if (this.dom.equipmentWidth) this.dom.equipmentWidth.value = product?.sizeMm.width ?? 1200;
    if (this.dom.equipmentDepth) this.dom.equipmentDepth.value = product?.sizeMm.depth ?? 1000;
    if (this.dom.equipmentHeight) this.dom.equipmentHeight.value = product?.sizeMm.height ?? 150;
    if (this.dom.equipmentColor) this.dom.equipmentColor.value = product?.color ?? '#94a3b8';
    this.dom.equipmentProductForm?.classList.remove('hidden');
    this.dom.equipmentName?.focus();
  }

  closeEquipmentForm() {
    this.editingEquipmentId = null;
    this.dom.equipmentProductForm?.reset();
    this.dom.equipmentProductForm?.classList.add('hidden');
  }

  setEquipmentStatus(message, isError) {
    if (!this.dom.equipmentCatalogStatus) return;
    this.dom.equipmentCatalogStatus.textContent = message;
    this.dom.equipmentCatalogStatus.classList.toggle('error', isError);
  }

  renderEquipmentCatalog() {
    if (!this.dom.equipmentCatalogList) return;
    this.dom.equipmentCatalogList.replaceChildren();
    this.catalogProducts.forEach((product) => {
      const row = document.createElement('div');
      row.className = `equipment-product-row${product.active ? '' : ' is-archived'}`;

      const description = document.createElement('div');
      description.className = 'equipment-product-description';
      const title = document.createElement('strong');
      title.textContent = product.name;
      const details = document.createElement('span');
      details.textContent = `${product.brand} · ${product.sizeMm.width} × ${product.sizeMm.depth} × ${product.sizeMm.height} mm`;
      description.append(title, details);

      const actions = document.createElement('div');
      actions.className = 'equipment-product-actions';
      const addAction = (action, label) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.dataset.productId = product.id;
        button.textContent = label;
        actions.append(button);
      };
      if (product.active) addAction('place', 'Place');
      addAction('edit', 'Edit');
      addAction(product.active ? 'archive' : 'restore', product.active ? 'Archive' : 'Restore');
      row.append(description, actions);
      this.dom.equipmentCatalogList.append(row);
    });
  }

  bindEvents() {
    // 1. Length Binding
    this.bindDimensionControls(
      'length',
      this.dom.lengthInput,
      this.dom.lengthSlider,
      this.dom.lengthMinus,
      this.dom.lengthPlus
    );

    // 2. Width Binding
    this.bindDimensionControls(
      'width',
      this.dom.widthInput,
      this.dom.widthSlider,
      this.dom.widthMinus,
      this.dom.widthPlus
    );

    // 3. Height Binding
    this.bindDimensionControls(
      'height',
      this.dom.heightInput,
      this.dom.heightSlider,
      this.dom.heightMinus,
      this.dom.heightPlus
    );

    // 4. Quick Presets
    this.dom.presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = Number(btn.dataset.length);
        const w = Number(btn.dataset.width);
        const h = Number(btn.dataset.height);
        store.setDimension('length', l);
        store.setDimension('width', w);
        store.setDimension('height', h);
      });
    });

    // 5. Thickness Buttons
    this.dom.thicknessBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const thickness = Number(btn.dataset.thickness);
        store.setWallThickness(thickness);
      });
    });

    // 6. Floor Type Buttons
    this.dom.floorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const isInsulated = btn.dataset.floor === 'insulated';
        store.setHasInsulatedFloor(isInsulated);
      });
    });

    // 7. Camera Preset Buttons
    this.dom.cameraBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        store.setCameraPreset(preset);
        this.sceneManager.setCameraView(preset);
      });
    });

    // 8. Viewport Toggles
    if (this.dom.btnRoof) {
      this.dom.btnRoof.addEventListener('click', () => {
        store.toggleViewSetting('showCeiling');
      });
    }

    if (this.dom.btnDimensions) {
      this.dom.btnDimensions.addEventListener('click', () => {
        store.toggleViewSetting('showDimensions');
      });
    }

    if (this.dom.btnGrid) {
      this.dom.btnGrid.addEventListener('click', () => {
        store.toggleViewSetting('showGrid');
      });
    }

    if (this.dom.btnWireframe) {
      this.dom.btnWireframe.addEventListener('click', () => {
        store.toggleViewSetting('showWireframe');
      });
    }

    if (this.dom.btnToggleWallXray) {
      this.dom.btnToggleWallXray.addEventListener('click', () => {
        store.toggleViewSetting('showWallXray');
      });
    }

    // 9. Reset Button
    if (this.dom.btnReset) {
      this.dom.btnReset.addEventListener('click', () => {
        if (confirm('Reset room dimensions to standard 4000 × 3000 × 2400 mm?')) {
          store.resetRoom();
        }
      });
    }

    // 10. JSON Modal
    const openModal = () => this.openJSONModal();
    if (this.dom.btnInspectJson) this.dom.btnInspectJson.addEventListener('click', openModal);
    if (this.dom.btnInspectJsonHud) this.dom.btnInspectJsonHud.addEventListener('click', openModal);
    if (this.dom.btnCloseModal) this.dom.btnCloseModal.addEventListener('click', () => this.closeJSONModal());

    // Tab switching
    if (this.dom.btnTabExport) {
      this.dom.btnTabExport.addEventListener('click', () => this.switchJSONTab('export'));
    }
    if (this.dom.btnTabImport) {
      this.dom.btnTabImport.addEventListener('click', () => this.switchJSONTab('import'));
    }
    if (this.dom.btnCancelImport) {
      this.dom.btnCancelImport.addEventListener('click', () => this.switchJSONTab('export'));
    }

    // Copy JSON
    if (this.dom.btnCopyJson) {
      this.dom.btnCopyJson.addEventListener('click', () => {
        navigator.clipboard.writeText(store.exportJSON());
        const originalText = this.dom.btnCopyJson.textContent;
        this.dom.btnCopyJson.textContent = '✓ Copied!';
        setTimeout(() => {
          this.dom.btnCopyJson.textContent = originalText;
        }, 2000);
      });
    }

    // Download JSON
    if (this.dom.btnDownloadJson) {
      this.dom.btnDownloadJson.addEventListener('click', () => {
        const json = store.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cold-room-${store.room.dimensions.length}x${store.room.dimensions.width}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Apply / Import JSON
    if (this.dom.btnApplyJson) {
      this.dom.btnApplyJson.addEventListener('click', () => {
        const text = this.dom.jsonTextarea.value.trim();
        const success = store.importJSON(text);
        if (success) {
          this.dom.importError.textContent = '';
          this.closeJSONModal();
        } else {
          this.dom.importError.textContent = 'Invalid room JSON. Please check dimensions.';
        }
      });
    }
  }

  bindDimensionControls(key, numInput, sliderInput, minusBtn, plusBtn) {
    if (!numInput || !sliderInput) return;

    numInput.addEventListener('change', () => {
      store.setDimension(key, Number(numInput.value));
    });

    sliderInput.addEventListener('input', () => {
      store.setDimension(key, Number(sliderInput.value));
    });

    if (minusBtn) {
      minusBtn.addEventListener('click', () => {
        const current = Number(numInput.value);
        store.setDimension(key, current - 100);
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        const current = Number(numInput.value);
        store.setDimension(key, current + 100);
      });
    }
  }

  /**
   * Updates all UI elements with current store values
   */
  update(state) {
    const { room, viewSettings } = state;
    const { length, width, height, wallThickness } = room.dimensions;
    this.updateDoorControls(room);
    this.updateEquipmentControls(room);

    // Update Input Values
    if (this.dom.lengthInput) this.dom.lengthInput.value = length;
    if (this.dom.lengthSlider) this.dom.lengthSlider.value = length;

    if (this.dom.widthInput) this.dom.widthInput.value = width;
    if (this.dom.widthSlider) this.dom.widthSlider.value = width;

    if (this.dom.heightInput) this.dom.heightInput.value = height;
    if (this.dom.heightSlider) this.dom.heightSlider.value = height;

    // Update Thickness Buttons Active State
    this.dom.thicknessBtns.forEach((btn) => {
      const t = Number(btn.dataset.thickness);
      if (t === wallThickness) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Floor Buttons Active State
    this.dom.floorBtns.forEach((btn) => {
      const isInsulated = btn.dataset.floor === 'insulated';
      if (isInsulated === room.hasInsulatedFloor) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Camera Buttons Active State
    this.dom.cameraBtns.forEach((btn) => {
      if (btn.dataset.preset === viewSettings.cameraPreset) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update View Toggles
    if (this.dom.btnRoof) {
      this.dom.btnRoof.classList.toggle('active', viewSettings.showCeiling);
      this.dom.btnRoof.querySelector('.label').textContent = viewSettings.showCeiling
        ? 'Roof On'
        : 'Roof Off';
    }
    if (this.dom.btnDimensions) {
      this.dom.btnDimensions.classList.toggle('active', viewSettings.showDimensions);
    }
    if (this.dom.btnGrid) {
      this.dom.btnGrid.classList.toggle('active', viewSettings.showGrid);
    }
    if (this.dom.btnWireframe) {
      this.dom.btnWireframe.classList.toggle('active', viewSettings.showWireframe);
    }
    if (this.dom.btnToggleWallXray) {
      this.dom.btnToggleWallXray.classList.toggle('active', viewSettings.showWallXray);
      this.dom.btnToggleWallXray.querySelector('.label').textContent = viewSettings.showWallXray
        ? 'Walls X-ray On'
        : 'Walls X-ray Off';
    }

    // Calculate Usable Metrics
    const internal = getInternalDimensions(room.dimensions, room.hasInsulatedFloor);
    const areaM2 = calculateFloorAreaM2(internal.lengthMm, internal.widthMm);
    const volumeM3 = calculateVolumeM3(
      internal.lengthMm,
      internal.widthMm,
      internal.heightMm
    );

    if (this.dom.statArea) {
      this.dom.statArea.textContent = `${formatDecimals(areaM2, 2)} m²`;
    }
    if (this.dom.statVolume) {
      this.dom.statVolume.textContent = `${formatDecimals(volumeM3, 2)} m³`;
    }
    if (this.dom.statInternal) {
      this.dom.statInternal.textContent = `${internal.lengthMm} × ${internal.widthMm} × ${internal.heightMm} mm`;
    }

    // Modular Panel Breakdown Calculation
    const panelData = calculateRoomPanels(room);
    const { summary } = panelData;

    if (this.dom.panelTotalCount) {
      this.dom.panelTotalCount.textContent = `${summary.totalPanels} Panels`;
    }
    if (this.dom.panelFullCount) {
      this.dom.panelFullCount.textContent = summary.totalFullPanels;
    }
    if (this.dom.panelCutCount) {
      this.dom.panelCutCount.textContent = summary.totalCutPanels;
    }
    if (this.dom.panelTotalArea) {
      this.dom.panelTotalArea.textContent = `${formatDecimals(summary.totalPanelAreaM2, 1)} m²`;
    }

    const formatRun = (run) => {
      let str = `${run.fullCount} × 1000mm`;
      if (run.cutWidthMm > 0) {
        str += ` + 1 × ${run.cutWidthMm}mm (Cut)`;
      }
      return str;
    };

    if (this.dom.wbNorth) this.dom.wbNorth.textContent = formatRun(panelData.northWall);
    if (this.dom.wbSouth) this.dom.wbSouth.textContent = formatRun(panelData.southWall);
    if (this.dom.wbEast) this.dom.wbEast.textContent = formatRun(panelData.eastWall);
    if (this.dom.wbWest) this.dom.wbWest.textContent = formatRun(panelData.westWall);
    if (this.dom.wbCeiling) {
      this.dom.wbCeiling.textContent = `${formatRun(panelData.ceiling)} (span ${formatDecimals(room.dimensions.width / 1000, 1)}m)`;
    }

    if (this.dom.wbFloorRow && this.dom.wbFloor) {
      if (room.hasInsulatedFloor && panelData.floor) {
        this.dom.wbFloorRow.classList.remove('hidden');
        this.dom.wbFloor.textContent = `${formatRun(panelData.floor)} (span ${formatDecimals(room.dimensions.width / 1000, 1)}m)`;
      } else {
        this.dom.wbFloorRow.classList.add('hidden');
      }
    }

    if (this.dom.cutListAlert && this.dom.cutListText) {
      if (summary.totalCutPanels > 0) {
        this.dom.cutListAlert.classList.remove('hidden');
        const cutDescriptions = summary.cutList
          .map((c) => `${c.widthMm}mm`)
          .join(', ');
        this.dom.cutListText.textContent = `Custom cuts: ${summary.cutList.length} panels (${cutDescriptions})`;
      } else {
        this.dom.cutListAlert.classList.add('hidden');
      }
    }

    // Update JSON Preformatted text if modal open
    if (this.dom.jsonPre && !this.dom.jsonModal.classList.contains('hidden')) {
      this.dom.jsonPre.textContent = store.exportJSON();
    }
  }

  updateDoorControls(room) {
    const doors = Array.isArray(room.doors) ? room.doors : [];
    if (!doors.some((door) => door.id === this.selectedDoorId)) this.selectedDoorId = null;

    if (this.dom.targetTemperatureInput) {
      this.dom.targetTemperatureInput.value = room.targetTemperatureC;
    }
    if (this.dom.targetTemperatureValue) {
      this.dom.targetTemperatureValue.textContent = `${room.targetTemperatureC}°C`;
    }
    if (this.dom.heatedSillStatus) {
      const sillEnabled = requiresHeatedSill(room.targetTemperatureC);
      this.dom.heatedSillStatus.textContent = `Heated door sill: ${sillEnabled ? 'On' : 'Off'}`;
      this.dom.heatedSillStatus.classList.toggle('is-enabled', sillEnabled);
    }
    if (this.dom.doorCount) {
      this.dom.doorCount.textContent = `${doors.length} ${doors.length === 1 ? 'door' : 'doors'}`;
    }
    if (this.dom.btnAddDoor) {
      this.dom.btnAddDoor.textContent = this.sceneManager.doorPlacementEnabled
        ? 'Cancel Placement'
        : 'Place Door in 3D';
    }
    if (this.dom.doorList) {
      this.dom.doorList.replaceChildren();
      doors.forEach((door, index) => {
        const row = document.createElement('div');
        row.className = 'door-list-row';

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'door-list-select';
        selectButton.dataset.action = 'select';
        selectButton.dataset.doorId = door.id;
        selectButton.setAttribute('aria-pressed', String(door.id === this.selectedDoorId));
        selectButton.classList.toggle('active', door.id === this.selectedDoorId);
        const wallName = door.wall.charAt(0).toUpperCase() + door.wall.slice(1);
        selectButton.textContent = `Door ${index + 1} · ${wallName} · ${door.widthMm} × ${door.heightMm} mm`;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'door-list-remove';
        removeButton.dataset.action = 'remove';
        removeButton.dataset.doorId = door.id;
        removeButton.setAttribute('aria-label', `Remove door ${index + 1}`);
        removeButton.textContent = 'Remove';

        row.append(selectButton, removeButton);
        this.dom.doorList.append(row);
      });
    }

    const selectedDoor = this.getSelectedDoor();
    if (this.dom.doorFloatingControls) {
      this.dom.doorFloatingControls.classList.toggle('hidden', !selectedDoor);
    }
    if (!selectedDoor) return;

    if (this.dom.selectedDoorLabel) {
      this.dom.selectedDoorLabel.textContent = `${selectedDoor.wall.toUpperCase()} · ${selectedDoor.widthMm} × ${selectedDoor.heightMm} mm`;
    }
    if (this.dom.doorTypeSelect) this.dom.doorTypeSelect.value = selectedDoor.doorType;
    if (this.dom.btnFlipHinge) {
      this.dom.btnFlipHinge.textContent = `Flip Hinge · ${selectedDoor.hingeSide}`;
      this.dom.btnFlipHinge.disabled = selectedDoor.doorType !== 'hinged';
    }
    if (this.dom.btnFlipSwing) {
      this.dom.btnFlipSwing.textContent = `Flip Swing · ${selectedDoor.swingDirection}`;
      this.dom.btnFlipSwing.disabled = selectedDoor.doorType !== 'hinged';
    }
  }

  updateEquipmentControls(room) {
    const equipment = Array.isArray(room.equipment) ? room.equipment : [];
    if (!equipment.some((item) => item.id === this.selectedEquipmentId)) {
      this.selectedEquipmentId = null;
    }
    if (!this.dom.placedEquipmentList) return;

    this.dom.placedEquipmentList.replaceChildren();
    equipment.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'placed-equipment-row';

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'placed-equipment-select';
      selectButton.dataset.action = 'select';
      selectButton.dataset.equipmentId = item.id;
      selectButton.classList.toggle('active', item.id === this.selectedEquipmentId);
      selectButton.setAttribute('aria-pressed', String(item.id === this.selectedEquipmentId));
      selectButton.textContent = `${index + 1}. ${item.name} · ${item.brand}`;

      const rotateButton = document.createElement('button');
      rotateButton.type = 'button';
      rotateButton.className = 'equipment-item-action';
      rotateButton.dataset.action = 'rotate';
      rotateButton.dataset.equipmentId = item.id;
      rotateButton.setAttribute('aria-label', `Rotate ${item.name} 90 degrees`);
      rotateButton.textContent = '↻ 90°';

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'equipment-item-action is-remove';
      removeButton.dataset.action = 'remove';
      removeButton.dataset.equipmentId = item.id;
      removeButton.setAttribute('aria-label', `Remove ${item.name} from room`);
      removeButton.textContent = 'Remove';

      row.append(selectButton, rotateButton, removeButton);
      this.dom.placedEquipmentList.append(row);
    });
  }

  openJSONModal() {
    this.dom.jsonPre.textContent = store.exportJSON();
    this.dom.jsonModal.classList.remove('hidden');
    this.switchJSONTab('export');
  }

  closeJSONModal() {
    this.dom.jsonModal.classList.add('hidden');
    if (this.dom.importError) this.dom.importError.textContent = '';
  }

  switchJSONTab(tab) {
    if (tab === 'export') {
      this.dom.btnTabExport.classList.add('active');
      this.dom.btnTabImport.classList.remove('active');
      this.dom.panelExport.classList.remove('hidden');
      this.dom.panelImport.classList.add('hidden');
      this.dom.jsonPre.textContent = store.exportJSON();
    } else {
      this.dom.btnTabImport.classList.add('active');
      this.dom.btnTabExport.classList.remove('active');
      this.dom.panelImport.classList.remove('hidden');
      this.dom.panelExport.classList.add('hidden');
      this.dom.jsonTextarea.value = store.exportJSON();
    }
  }
}

