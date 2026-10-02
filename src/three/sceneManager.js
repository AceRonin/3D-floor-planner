import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomRenderer } from './roomRenderer.js';
import { DimensionOverlay } from './dimensionOverlay.js';
import { mmToM } from '../logic/calculations.js';
import { STANDARD_PANEL_WIDTH_MM } from '../logic/panelSplitting.js';
import { snapDoorToJoint, validateDoorPlacement } from '../logic/doorLogic.js';
import { getEquipmentFootprintMm, validateEquipmentPlacement } from '../logic/equipmentLogic.js';

export class SceneManager {
  constructor(canvas, overlayContainer) {
    this.canvas = canvas;
    this.overlayContainer = overlayContainer;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(5.5, 4.5, 6.5);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.02; // Do not go below floor level
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 40;

    // 5. Lighting Setup
    this.setupLights();

    // 6. Ground & Grid
    this.setupGround();

    // 7. Renderers
    this.roomRenderer = new RoomRenderer(this.scene);
    this.dimensionOverlay = new DimensionOverlay(this.overlayContainer, this.camera);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.doorPlacementEnabled = false;
    this.previewMesh = null;
    this.previewMaterial = null;
    this.dragStart = null;
    this.draggingDoor = false;
    this.equipmentPlacementProduct = null;
    this.equipmentGesture = null;
    this.equipmentPreviewMesh = null;
    this.equipmentPreviewMaterial = null;
    this.callbacks = {};
    this.equipmentCallbacks = {};
    this.bindDoorPointerEvents();

    this.currentRoomConfig = null;
    this.currentViewSettings = null;

    // Event listeners
    window.addEventListener('resize', () => this.handleResize());

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLights() {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    // Key directional light with soft shadows
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(10, 16, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 35;
    this.sunLight.shadow.camera.left = -10;
    this.sunLight.shadow.camera.right = 10;
    this.sunLight.shadow.camera.top = 10;
    this.sunLight.shadow.camera.bottom = -10;
    this.sunLight.shadow.bias = -0.0001;
    this.scene.add(this.sunLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4);
    fillLight.position.set(-8, 6, -8);
    this.scene.add(fillLight);

    // Ground bounce light
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.5);
    this.scene.add(hemiLight);
  }

  setupGround() {
    // Ground Foundation Pad (Workshop concrete floor)
    const padGeo = new THREE.PlaneGeometry(30, 30);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.groundPad = new THREE.Mesh(padGeo, padMat);
    this.groundPad.rotation.x = -Math.PI / 2;
    this.groundPad.position.y = -0.01;
    this.groundPad.receiveShadow = true;
    this.scene.add(this.groundPad);

    // Floor Grid
    this.grid = new THREE.GridHelper(30, 30, 0x64748b, 0x334155);
    this.grid.position.y = -0.005;
    this.scene.add(this.grid);
  }

  updateState(roomConfig, viewSettings) {
    this.currentRoomConfig = roomConfig;
    this.currentViewSettings = viewSettings;
    this.clearDoorPreview();
    this.clearEquipmentPreview();

    // Toggle grid
    this.grid.visible = viewSettings.showGrid;

    // Update 3D room meshes
    this.roomRenderer.update(roomConfig, viewSettings);

    // Update dynamic framing if preset was explicitly triggered
    this.applyCameraPreset(viewSettings.cameraPreset, roomConfig);
  }

  setDoorCallbacks(callbacks) {
    this.callbacks = callbacks;
  }

  setDoorPlacementEnabled(enabled) {
    if (enabled) this.setEquipmentPlacementProduct(null);
    this.doorPlacementEnabled = enabled;
    this.canvas.style.cursor = enabled ? 'crosshair' : 'default';
    if (!enabled) this.clearDoorPreview();
    this.callbacks.onPlacementStatus?.({
      active: enabled,
      valid: false,
      message: enabled ? 'Hover over a wall, then click to place.' : 'Select a door or start placement.',
    });
  }

  setEquipmentCallbacks(callbacks) {
    this.equipmentCallbacks = callbacks;
  }

  setEquipmentPlacementProduct(product) {
    this.doorPlacementEnabled = false;
    this.canvas.style.cursor = product ? 'crosshair' : 'default';
    this.equipmentPlacementProduct = product
      ? {
          ...product,
          sizeMm: { ...product.sizeMm },
          placementId: globalThis.crypto?.randomUUID?.() ?? `equipment-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        }
      : null;
    this.clearEquipmentPreview();
    this.equipmentCallbacks.onEquipmentStatus?.({
      active: Boolean(this.equipmentPlacementProduct),
      valid: false,
      message: this.equipmentPlacementProduct
        ? `Hover over a ${product.mountType === 'wall' ? 'wall' : 'floor'} surface, then click to place.`
        : 'Select a product to place equipment.',
    });
  }

  bindDoorPointerEvents() {
    this.canvas.addEventListener('pointermove', (event) => this.handleDoorPointerMove(event));
    this.canvas.addEventListener('pointerdown', (event) => this.handleDoorPointerDown(event), true);
    this.canvas.addEventListener('pointerup', (event) => this.handleDoorPointerUp(event));
    this.canvas.addEventListener('pointercancel', () => {
      this.dragStart = null;
      this.draggingDoor = false;
      this.controls.enabled = true;
      this.clearDoorPreview();
    });
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.dragStart) this.clearDoorPreview();
    });
  }

  updateRay(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  getDoorAtPointer() {
    this.scene.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(this.roomRenderer.doorMeshes, false);
    return hits[0]?.object.userData.doorId ?? null;
  }

  getEquipmentAtPointer() {
    this.scene.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(this.roomRenderer.equipmentMeshes, false);
    return hits[0]?.object.userData.equipmentId ?? null;
  }

  getEquipmentCandidate(event, product, baseEquipment = null) {
    if (!this.currentRoomConfig || !product) return null;
    this.updateRay(event);
    this.scene.updateMatrixWorld(true);

    const { dimensions } = this.currentRoomConfig;
    const floorBaseMm = this.currentRoomConfig.hasInsulatedFloor ? dimensions.wallThickness : 0;
    const ceilingBaseMm = dimensions.height - dimensions.wallThickness;
    const equipment = {
      id: baseEquipment?.id ?? product.placementId,
      productId: baseEquipment?.productId ?? product.id,
      name: baseEquipment?.name ?? product.name,
      brand: baseEquipment?.brand ?? product.brand,
      mountType: baseEquipment?.mountType ?? product.mountType,
      mountWall: null,
      positionMm: { x: 0, y: 0, z: 0 },
      sizeMm: { ...product.sizeMm },
      rotationYDeg: baseEquipment?.rotationYDeg ?? 0,
      color: product.color,
      modelSource: product.modelSource ?? 'box',
    };

    if (equipment.mountType === 'floor') {
      const floorBaseM = mmToM(floorBaseMm);
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorBaseM);
      const point = this.raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
      if (!point) return null;
      equipment.positionMm = {
        x: point.x * 1000,
        y: floorBaseMm + equipment.sizeMm.height / 2,
        z: point.z * 1000,
      };
    } else {
      const wallHit = this.raycaster.intersectObjects(this.roomRenderer.wallMeshes, false)[0];
      if (!wallHit) return null;
      equipment.mountWall = wallHit.object.userData.wall;
      if (!baseEquipment) equipment.rotationYDeg = ['east', 'west'].includes(equipment.mountWall) ? 90 : 0;
      const footprint = getEquipmentFootprintMm(equipment);
      const halfRoomLength = dimensions.length / 2 - dimensions.wallThickness;
      const halfRoomWidth = dimensions.width / 2 - dimensions.wallThickness;
      const wallHeightMm = Math.min(
        ceilingBaseMm - equipment.sizeMm.height / 2,
        Math.max(floorBaseMm + equipment.sizeMm.height / 2, wallHit.point.y * 1000)
      );
      const wallPositions = {
        north: {
          x: wallHit.point.x * 1000,
          y: wallHeightMm,
          z: halfRoomWidth - footprint.depthMm / 2,
        },
        south: {
          x: wallHit.point.x * 1000,
          y: wallHeightMm,
          z: -halfRoomWidth + footprint.depthMm / 2,
        },
        east: {
          x: halfRoomLength - footprint.widthMm / 2,
          y: wallHeightMm,
          z: wallHit.point.z * 1000,
        },
        west: {
          x: -halfRoomLength + footprint.widthMm / 2,
          y: wallHeightMm,
          z: wallHit.point.z * 1000,
        },
      };
      equipment.positionMm = wallPositions[equipment.mountWall];
    }

    const existingEquipment = this.currentRoomConfig.equipment.filter((item) => item.id !== equipment.id);
    const validation = validateEquipmentPlacement(equipment, this.currentRoomConfig, existingEquipment);
    return { equipment, valid: validation.isValid, message: validation.error ?? 'Valid position.' };
  }

  showEquipmentPreview(candidate) {
    this.clearEquipmentPreview();
    if (!candidate?.equipment) {
      this.equipmentCallbacks.onEquipmentStatus?.({
        active: Boolean(this.equipmentPlacementProduct || this.equipmentGesture),
        valid: false,
        message: candidate?.message ?? 'Move over a valid surface to preview equipment.',
      });
      return;
    }

    const { equipment } = candidate;
    this.equipmentPreviewMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        mmToM(equipment.sizeMm.width),
        mmToM(equipment.sizeMm.height),
        mmToM(equipment.sizeMm.depth)
      ),
      new THREE.MeshBasicMaterial({
        color: candidate.valid ? 0x34d399 : 0xf87171,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      })
    );
    this.equipmentPreviewMaterial = this.equipmentPreviewMesh.material;
    this.equipmentPreviewMesh.position.set(
      mmToM(equipment.positionMm.x),
      mmToM(equipment.positionMm.y),
      mmToM(equipment.positionMm.z)
    );
    this.equipmentPreviewMesh.rotation.y = (equipment.rotationYDeg * Math.PI) / 180;
    this.scene.add(this.equipmentPreviewMesh);
    this.equipmentCallbacks.onEquipmentStatus?.({
      active: Boolean(this.equipmentPlacementProduct || this.equipmentGesture),
      valid: candidate.valid,
      message: candidate.message,
      equipment,
    });
  }

  clearEquipmentPreview() {
    if (!this.equipmentPreviewMesh) return;
    this.scene.remove(this.equipmentPreviewMesh);
    this.equipmentPreviewMesh.geometry.dispose();
    this.equipmentPreviewMaterial?.dispose();
    this.equipmentPreviewMesh = null;
    this.equipmentPreviewMaterial = null;
  }

  getPlacementCandidate(event, baseDoor = null) {
    if (!this.currentRoomConfig) return null;
    this.updateRay(event);
    this.scene.updateMatrixWorld(true);
    const wallHit = this.raycaster.intersectObjects(this.roomRenderer.wallMeshes, false)[0];
    if (!wallHit) return null;

    const { dimensions } = this.currentRoomConfig;
    const wall = wallHit.object.userData.wall;
    const requestedOffsetMm = wall === 'north' || wall === 'south'
      ? wallHit.point.x * 1000 + dimensions.length / 2
      : wallHit.point.z * 1000 + (dimensions.width - 2 * dimensions.wallThickness) / 2;
    const doorTemplate = baseDoor ?? {
      widthMm: 900,
      heightMm: 2000,
      doorType: 'hinged',
      hingeSide: 'left',
      swingDirection: 'out',
    };
    const offsetMm = snapDoorToJoint(
      requestedOffsetMm,
      wall,
      dimensions,
      doorTemplate.widthMm,
      STANDARD_PANEL_WIDTH_MM
    );
    if (offsetMm === null) {
      return { valid: false, message: 'No panel joint fits with the required corner clearance.' };
    }

    const door = { ...doorTemplate, wall, offsetMm };
    const existingDoors = this.currentRoomConfig.doors.filter((item) => item.id !== door.id);
    const validation = validateDoorPlacement(door, dimensions, existingDoors);
    const usableWallHeightMm = dimensions.height - dimensions.wallThickness -
      (this.currentRoomConfig.hasInsulatedFloor ? dimensions.wallThickness : 0);
    if (!validation.isValid) return { valid: false, message: validation.error };
    if (door.heightMm > usableWallHeightMm) {
      return { valid: false, message: 'Door is taller than the usable wall.' };
    }

    return { valid: true, message: 'Valid snapped position.', door };
  }

  showDoorPreview(candidate, doorTemplate = null) {
    this.clearDoorPreview();
    if (!candidate?.door || !this.currentRoomConfig) {
      this.callbacks.onPlacementStatus?.({
        active: this.doorPlacementEnabled || Boolean(this.draggingDoor),
        valid: false,
        message: candidate?.message ?? 'Move over a wall to preview a door.',
      });
      return;
    }

    const { dimensions } = this.currentRoomConfig;
    const { door } = candidate;
    const thicknessM = mmToM(dimensions.wallThickness) + 0.04;
    const widthM = mmToM(door.widthMm);
    const heightM = mmToM(door.heightMm);
    const geometry = door.wall === 'north' || door.wall === 'south'
      ? new THREE.BoxGeometry(widthM, heightM, thicknessM)
      : new THREE.BoxGeometry(thicknessM, heightM, widthM);
    this.previewMaterial = new THREE.MeshBasicMaterial({
      color: candidate.valid ? 0x34d399 : 0xf87171,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.previewMesh = new THREE.Mesh(geometry, this.previewMaterial);
    const halfLengthM = mmToM(dimensions.length) / 2;
    const halfWidthM = mmToM(dimensions.width) / 2;
    const halfSideRunM = (mmToM(dimensions.width) - 2 * mmToM(dimensions.wallThickness)) / 2;
    const floorBaseM = this.currentRoomConfig.hasInsulatedFloor ? mmToM(dimensions.wallThickness) : 0;
    const wallCenters = {
      north: [0, halfWidthM - mmToM(dimensions.wallThickness) / 2],
      south: [0, -halfWidthM + mmToM(dimensions.wallThickness) / 2],
      east: [halfLengthM - mmToM(dimensions.wallThickness) / 2, 0],
      west: [-halfLengthM + mmToM(dimensions.wallThickness) / 2, 0],
    };
    if (door.wall === 'north' || door.wall === 'south') {
      this.previewMesh.position.set(
        -halfLengthM + mmToM(door.offsetMm + door.widthMm / 2),
        floorBaseM + heightM / 2,
        wallCenters[door.wall][1]
      );
    } else {
      this.previewMesh.position.set(
        wallCenters[door.wall][0],
        floorBaseM + heightM / 2,
        -halfSideRunM + mmToM(door.offsetMm + door.widthMm / 2)
      );
    }
    this.previewMesh.userData.doorTemplate = doorTemplate;
    this.scene.add(this.previewMesh);
    this.callbacks.onPlacementStatus?.({
      active: this.doorPlacementEnabled || Boolean(this.draggingDoor),
      valid: candidate.valid,
      message: candidate.message,
      door,
    });
  }

  clearDoorPreview() {
    if (!this.previewMesh) return;
    this.scene.remove(this.previewMesh);
    this.previewMesh.geometry.dispose();
    this.previewMaterial?.dispose();
    this.previewMesh = null;
    this.previewMaterial = null;
  }

  handleDoorPointerMove(event) {
    if (this.equipmentGesture) {
      const gesture = this.equipmentGesture;
      const distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      if (distance > 4 && !gesture.dragging) {
        gesture.dragging = true;
        this.controls.enabled = false;
      }
      if (gesture.dragging) {
        const candidate = this.getEquipmentCandidate(
          event,
          gesture.item ?? gesture.product,
          gesture.item
        );
        this.showEquipmentPreview(candidate);
      }
      return;
    }

    if (this.equipmentPlacementProduct) {
      this.showEquipmentPreview(
        this.getEquipmentCandidate(event, this.equipmentPlacementProduct)
      );
      return;
    }

    if (this.dragStart) {
      const distance = Math.hypot(
        event.clientX - this.dragStart.x,
        event.clientY - this.dragStart.y
      );
      if (distance > 4 && !this.draggingDoor) {
        this.draggingDoor = true;
        this.controls.enabled = false;
      }
      if (this.draggingDoor) {
        const candidate = this.getPlacementCandidate(event, this.dragStart.door);
        if (candidate?.door) candidate.door.id = this.dragStart.door.id;
        this.showDoorPreview(candidate, this.dragStart.door);
      }
      return;
    }

    if (!this.doorPlacementEnabled) return;
    const candidate = this.getPlacementCandidate(event);
    this.showDoorPreview(candidate);
  }

  handleDoorPointerDown(event) {
    if (event.button !== 0) return;
    this.updateRay(event);
    const equipmentId = this.getEquipmentAtPointer();
    if (equipmentId) {
      const item = this.currentRoomConfig?.equipment.find((equipment) => equipment.id === equipmentId);
      if (item) {
        event.stopPropagation();
        this.canvas.setPointerCapture?.(event.pointerId);
        this.equipmentGesture = {
          x: event.clientX,
          y: event.clientY,
          item: { ...item, positionMm: { ...item.positionMm }, sizeMm: { ...item.sizeMm } },
          dragging: false,
        };
        this.equipmentCallbacks.onEquipmentSelected?.(equipmentId);
      }
      return;
    }

    const doorId = this.getDoorAtPointer();
    if (doorId) {
      const door = this.currentRoomConfig?.doors.find((item) => item.id === doorId);
      if (door) {
        event.stopPropagation();
        this.canvas.setPointerCapture?.(event.pointerId);
        this.dragStart = {
          x: event.clientX,
          y: event.clientY,
          door: { ...door },
        };
        this.callbacks.onDoorSelected?.(doorId);
      }
      return;
    }

    if (this.equipmentPlacementProduct) {
      event.stopPropagation();
      this.canvas.setPointerCapture?.(event.pointerId);
      this.equipmentGesture = {
        x: event.clientX,
        y: event.clientY,
        product: this.equipmentPlacementProduct,
        item: null,
        dragging: false,
      };
      return;
    }

    if (this.doorPlacementEnabled) {
      event.stopPropagation();
      this.canvas.setPointerCapture?.(event.pointerId);
      this.dragStart = { x: event.clientX, y: event.clientY, door: null };
    }
  }

  handleDoorPointerUp(event) {
    if (this.equipmentGesture) {
      const gesture = this.equipmentGesture;
      if (this.canvas.hasPointerCapture?.(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      this.equipmentGesture = null;
      this.controls.enabled = true;
      const candidate = this.getEquipmentCandidate(
        event,
        gesture.item ?? gesture.product,
        gesture.item
      );
      if (candidate?.valid && candidate.equipment && (!gesture.item || gesture.dragging)) {
        this.equipmentCallbacks.onEquipmentPlaced?.(candidate.equipment);
      }
      this.clearEquipmentPreview();
      return;
    }

    if (!this.dragStart) return;
    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    const dragStart = this.dragStart;
    this.dragStart = null;
    this.controls.enabled = true;

    if (dragStart.door && this.draggingDoor) {
      const candidate = this.getPlacementCandidate(event, dragStart.door);
      if (candidate?.valid && candidate.door) {
        this.callbacks.onDoorPlaced?.({ ...candidate.door, id: dragStart.door.id });
      }
    } else if (!dragStart.door && this.doorPlacementEnabled) {
      const candidate = this.getPlacementCandidate(event);
      if (candidate?.valid && candidate.door) {
        const id = globalThis.crypto?.randomUUID?.() ?? `door-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        this.callbacks.onDoorPlaced?.({ ...candidate.door, id });
      }
    }

    this.draggingDoor = false;
    this.clearDoorPreview();
  }

  applyCameraPreset(preset, roomConfig) {
    if (!roomConfig) return;

    const lengthM = mmToM(roomConfig.dimensions.length);
    const widthM = mmToM(roomConfig.dimensions.width);
    const heightM = mmToM(roomConfig.dimensions.height);

    const maxDim = Math.max(lengthM, widthM, heightM);
    const targetY = heightM / 2;

    this.controls.target.set(0, targetY, 0);
    const dist = maxDim * 1.6;

    switch (preset) {
      case 'top':
        this.camera.position.set(0, dist * 1.5, 0.001);
        break;
      case 'front':
        this.camera.position.set(0, targetY, dist * 1.3);
        break;
      case 'isometric':
        this.camera.position.set(dist, dist * 0.9, dist);
        break;
      case 'perspective':
      default:
        // Do not jump camera if user is actively orbiting unless preset changed
        break;
    }

    this.camera.lookAt(0, targetY, 0);
    this.controls.update();
  }

  setCameraView(preset) {
    if (this.currentRoomConfig) {
      const lengthM = mmToM(this.currentRoomConfig.dimensions.length);
      const widthM = mmToM(this.currentRoomConfig.dimensions.width);
      const heightM = mmToM(this.currentRoomConfig.dimensions.height);
      const maxDim = Math.max(lengthM, widthM, heightM);
      const targetY = heightM / 2;
      const dist = maxDim * 1.6;

      this.controls.target.set(0, targetY, 0);

      if (preset === 'top') {
        this.camera.position.set(0, dist * 1.5, 0.001);
      } else if (preset === 'front') {
        this.camera.position.set(0, targetY, dist * 1.3);
      } else if (preset === 'isometric') {
        this.camera.position.set(dist, dist * 0.9, dist);
      } else {
        this.camera.position.set(dist * 0.9, dist * 0.7, dist * 1.1);
      }

      this.camera.lookAt(0, targetY, 0);
      this.controls.update();
    }
  }

  handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // Update overlay dimension tags
    if (this.currentRoomConfig && this.currentViewSettings) {
      this.dimensionOverlay.update(
        this.currentRoomConfig,
        this.currentViewSettings.showDimensions,
        this.canvas
      );
    }
  }
}

