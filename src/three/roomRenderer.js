import * as THREE from 'three';
import { mmToM } from '../logic/calculations.js';
import { calculateRoomPanels } from '../logic/panelSplitting.js';

/**
 * Renders individual modular insulated panels (walls, ceiling, floor)
 * with visible panel joint seams and cut-panel highlights.
 */
export class RoomRenderer {
  constructor(scene) {
    this.scene = scene;
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    // Standard Panel Material (RAL 9002 White Grey PPGI steel)
    this.panelMaterial = new THREE.MeshStandardMaterial({
      color: 0xeef2f6,
      roughness: 0.4,
      metalness: 0.2,
    });

    // Custom Cut Panel Material (Subtle amber-tinted badge edge for quick identification)
    this.cutPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e7ff, // Subtle ice-blue tint to differentiate custom cut panels
      roughness: 0.45,
      metalness: 0.2,
    });
    this.wallPanelMaterial = this.panelMaterial.clone();
    this.wallCutPanelMaterial = this.cutPanelMaterial.clone();

    // Dark Cam-lock Joint Seam Material
    this.seamMaterial = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
    });

    // Corner Trim Material (RAL 5002 Blue)
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.3,
      metalness: 0.5,
    });

    // Ceiling Material
    this.ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
    });

    // Insulated Floor Material
    this.insulatedFloorMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.5,
      metalness: 0.3,
    });

    // Concrete Interior Floor Material
    this.concreteFloorMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.doorFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8e0e8,
      roughness: 0.38,
      metalness: 0.3,
    });
    this.doorLeafMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.52,
      metalness: 0.2,
    });
    this.doorHandleMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.25,
      metalness: 0.75,
    });
    this.heatedSillMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.32,
      metalness: 0.45,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    });
    this.wallMeshes = [];
    this.doorMeshes = [];
    this.equipmentMeshes = [];
  }

  /**
   * Rebuilds the modular 3D room from the plain JSON room configuration.
   * @param {Object} roomConfig
   * @param {Object} viewSettings
   */
  update(roomConfig, viewSettings) {
    // Clear previous 3D objects
    while (this.roomGroup.children.length > 0) {
      const child = this.roomGroup.children[0];
      this.roomGroup.remove(child);
      child.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.userData.disposeMaterial && object.material) object.material.dispose();
      });
    }
    this.wallMeshes = [];
    this.doorMeshes = [];
    this.equipmentMeshes = [];

    const { length, width, height, wallThickness } = roomConfig.dimensions;
    const hasInsulatedFloor = roomConfig.hasInsulatedFloor;
    const { showCeiling, showWireframe, showWallXray } = viewSettings;
    this.currentShowWireframe = showWireframe;

    // Apply wireframe toggle
    [
      this.panelMaterial,
      this.cutPanelMaterial,
      this.wallPanelMaterial,
      this.wallCutPanelMaterial,
      this.trimMaterial,
      this.ceilingMaterial,
      this.insulatedFloorMaterial,
      this.doorFrameMaterial,
      this.doorLeafMaterial,
      this.doorHandleMaterial,
      this.heatedSillMaterial,
    ].forEach((mat) => {
      mat.wireframe = showWireframe;
    });
    [this.wallPanelMaterial, this.wallCutPanelMaterial, this.doorLeafMaterial].forEach((mat) => {
      mat.transparent = showWallXray;
      mat.opacity = showWallXray ? (mat === this.doorLeafMaterial ? 0.24 : 0.16) : 1;
      mat.depthWrite = !showWallXray;
      mat.needsUpdate = true;
    });

    // Calculate modular panel subdivision
    const panelData = calculateRoomPanels(roomConfig);

    const lengthM = mmToM(length);
    const widthM = mmToM(width);
    const heightM = mmToM(height);
    const tM = mmToM(wallThickness);

    const halfL = lengthM / 2;
    const halfW = widthM / 2;

    const floorThicknessM = hasInsulatedFloor ? tM : 0;
    const ceilingThicknessM = tM;
    const wallHeightM = mmToM(panelData.wallHeightMm);
    const wallCenterYM = floorThicknessM + wallHeightM / 2;

    // Small seam gap between panels for crisp visualization (1.5 mm in scene units)
    const seamGapM = 0.0015;

    // 1. Floor
    if (hasInsulatedFloor) {
      // Modular Insulated Floor Panels
      const floorPanels = panelData.floor.panels;
      floorPanels.forEach((p) => {
        const pWidthM = mmToM(p.widthMm);
        const pOffsetM = mmToM(p.offsetMm);
        const posX = -halfL + pOffsetM + pWidthM / 2;

        const pGeo = new THREE.BoxGeometry(
          Math.max(0.01, pWidthM - seamGapM),
          floorThicknessM,
          widthM - seamGapM
        );
        const pMesh = new THREE.Mesh(
          pGeo,
          p.isCut ? this.cutPanelMaterial : this.insulatedFloorMaterial
        );
        pMesh.position.set(posX, floorThicknessM / 2, 0);
        pMesh.castShadow = true;
        pMesh.receiveShadow = true;
        this.roomGroup.add(pMesh);
      });
    } else {
      // Concrete civil floor slab
      const slabGeo = new THREE.PlaneGeometry(
        Math.max(0.1, lengthM - 2 * tM),
        Math.max(0.1, widthM - 2 * tM)
      );
      const slabMesh = new THREE.Mesh(slabGeo, this.concreteFloorMaterial);
      slabMesh.rotation.x = -Math.PI / 2;
      slabMesh.position.set(0, 0.002, 0);
      slabMesh.receiveShadow = true;
      this.roomGroup.add(slabMesh);
    }

    // 2. North Wall (+Z front) - Modular panels along X axis
    this.addWallPanels(panelData.northWall.panels, 'north', roomConfig, wallHeightM, floorThicknessM, tM, seamGapM);

    // 3. South Wall (-Z back) - Modular panels along X axis
    this.addWallPanels(panelData.southWall.panels, 'south', roomConfig, wallHeightM, floorThicknessM, tM, seamGapM);

    // 4. East Wall (+X right) - Modular panels along Z axis (butting inside)
    const eastWestSpanM = widthM - 2 * tM;
    const halfEastWestSpanM = eastWestSpanM / 2;

    this.addWallPanels(panelData.eastWall.panels, 'east', roomConfig, wallHeightM, floorThicknessM, tM, seamGapM);

    // 5. West Wall (-X left) - Modular panels along Z axis (butting inside)
    this.addWallPanels(panelData.westWall.panels, 'west', roomConfig, wallHeightM, floorThicknessM, tM, seamGapM);

    roomConfig.doors.forEach((door) => {
      const doorGroup = this.createDoorGroup(door, roomConfig);
      this.roomGroup.add(doorGroup);
    });

    (roomConfig.equipment ?? []).forEach((equipment) => {
      const equipmentMesh = this.createEquipmentMesh(equipment);
      this.roomGroup.add(equipmentMesh);
    });

    // 6. Insulated Modular Ceiling Panels (spanning across width, along length)
    if (showCeiling) {
      panelData.ceiling.panels.forEach((p) => {
        const pWidthM = mmToM(p.widthMm);
        const pOffsetM = mmToM(p.offsetMm);
        const posX = -halfL + pOffsetM + pWidthM / 2;

        const pGeo = new THREE.BoxGeometry(
          Math.max(0.01, pWidthM - seamGapM),
          ceilingThicknessM,
          widthM - seamGapM
        );
        const pMesh = new THREE.Mesh(
          pGeo,
          p.isCut ? this.cutPanelMaterial : this.ceilingMaterial
        );
        pMesh.position.set(posX, heightM - ceilingThicknessM / 2, 0);
        pMesh.castShadow = true;
        pMesh.receiveShadow = true;
        this.roomGroup.add(pMesh);
      });
    }

    // 7. Corner Flashing Accents (4 outer vertical corners)
    const cornerPositions = [
      [-halfL, halfW],
      [halfL, halfW],
      [-halfL, -halfW],
      [halfL, -halfW],
    ];

    const cornerGeo = new THREE.BoxGeometry(0.04, wallHeightM, 0.04);
    cornerPositions.forEach(([x, z]) => {
      const cornerMesh = new THREE.Mesh(cornerGeo, this.trimMaterial);
      cornerMesh.position.set(x, wallCenterYM, z);
      this.roomGroup.add(cornerMesh);
    });
  }

  addWallPanels(panels, wall, roomConfig, wallHeightM, floorBaseYM, wallThicknessM, seamGapM) {
    const doors = roomConfig.doors
      .filter((door) => door.wall === wall)
      .sort((left, right) => left.offsetMm - right.offsetMm);

    panels.forEach((panel) => {
      const panelEndMm = panel.offsetMm + panel.widthMm;
      const material = panel.isCut ? this.wallCutPanelMaterial : this.wallPanelMaterial;
      let cursorMm = panel.offsetMm;

      doors.forEach((door) => {
        const openingStartMm = Math.max(panel.offsetMm, door.offsetMm);
        const openingEndMm = Math.min(panelEndMm, door.offsetMm + door.widthMm);
        if (openingEndMm <= openingStartMm || openingEndMm <= cursorMm) return;

        const visibleEndMm = Math.max(cursorMm, openingStartMm);
        this.addWallSection(
          wall,
          roomConfig,
          material,
          cursorMm,
          visibleEndMm - cursorMm,
          floorBaseYM,
          wallHeightM,
          wallThicknessM,
          seamGapM,
          panel.index
        );

        const clippedStartMm = Math.max(cursorMm, openingStartMm);
        const openingHeightM = Math.min(wallHeightM, mmToM(door.heightMm));
        const remainingHeightM = wallHeightM - openingHeightM;
        this.addWallSection(
          wall,
          roomConfig,
          material,
          clippedStartMm,
          openingEndMm - clippedStartMm,
          floorBaseYM + openingHeightM,
          remainingHeightM,
          wallThicknessM,
          seamGapM,
          panel.index
        );
        cursorMm = Math.max(cursorMm, openingEndMm);
      });

      this.addWallSection(
        wall,
        roomConfig,
        material,
        cursorMm,
        panelEndMm - cursorMm,
        floorBaseYM,
        wallHeightM,
        wallThicknessM,
        seamGapM,
        panel.index
      );
    });
  }

  addWallSection(
    wall,
    roomConfig,
    material,
    startMm,
    widthMm,
    bottomOffsetM,
    heightM,
    wallThicknessM,
    seamGapM,
    panelIndex
  ) {
    if (widthMm <= 0 || heightM <= 0) return;

    const { length, width, wallThickness } = roomConfig.dimensions;
    const halfLengthM = mmToM(length) / 2;
    const halfWidthM = mmToM(width) / 2;
    const halfSideRunM = (mmToM(width) - 2 * mmToM(wallThickness)) / 2;
    const sectionWidthM = Math.max(0.01, mmToM(widthMm) - seamGapM);
    const centerYM = bottomOffsetM + heightM / 2;
    const alongCenterM = mmToM(startMm + widthMm / 2);
    let geometry;
    let position;

    if (wall === 'north' || wall === 'south') {
      geometry = new THREE.BoxGeometry(sectionWidthM, heightM, wallThicknessM);
      position = [
        -halfLengthM + alongCenterM,
        centerYM,
        wall === 'north' ? halfWidthM - mmToM(wallThickness) / 2 : -halfWidthM + mmToM(wallThickness) / 2,
      ];
    } else {
      geometry = new THREE.BoxGeometry(wallThicknessM, heightM, sectionWidthM);
      position = [
        wall === 'east' ? halfLengthM - mmToM(wallThickness) / 2 : -halfLengthM + mmToM(wallThickness) / 2,
        centerYM,
        -halfSideRunM + alongCenterM,
      ];
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.wall = wall;
    mesh.userData.panelIndex = panelIndex;
    this.wallMeshes.push(mesh);
    this.roomGroup.add(mesh);
  }

  createDoorGroup(door, roomConfig) {
    const group = new THREE.Group();
    const { length, width, wallThickness } = roomConfig.dimensions;
    const thicknessM = mmToM(wallThickness);
    const halfLengthM = mmToM(length) / 2;
    const halfWidthM = mmToM(width) / 2;
    const sideRunMm = width - 2 * wallThickness;
    const sideRunHalfM = mmToM(sideRunMm) / 2;
    const floorBaseM = roomConfig.hasInsulatedFloor ? thicknessM : 0;
    const frameMm = 70;
    const doorHeightM = mmToM(door.heightMm);
    const doorWidthM = mmToM(door.widthMm);
    const axisSign = { north: 1, south: -1, east: -1, west: 1 }[door.wall] ?? 1;
    const wallRotationY = { north: 0, south: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[door.wall] ?? 0;
    const wallCenter = {
      north: [0, halfWidthM - thicknessM / 2],
      south: [0, -halfWidthM + thicknessM / 2],
      east: [halfLengthM - thicknessM / 2, 0],
      west: [-halfLengthM + thicknessM / 2, 0],
    }[door.wall];
    if (!wallCenter) return group;

    const createBox = (name, runMm, yM, widthMm, heightM, depthM, normalOffsetM, material) => {
      const widthAlongM = mmToM(widthMm);
      const isLongitudinalWall = door.wall === 'north' || door.wall === 'south';
      const geometry = isLongitudinalWall
        ? new THREE.BoxGeometry(widthAlongM, heightM, depthM)
        : new THREE.BoxGeometry(depthM, heightM, widthAlongM);
      const mesh = new THREE.Mesh(geometry, material);
      if (isLongitudinalWall) {
        mesh.position.set(
          -halfLengthM + mmToM(runMm),
          yM,
          wallCenter[1] + Math.sign(wallCenter[1]) * normalOffsetM
        );
      } else {
        mesh.position.set(
          wallCenter[0] + Math.sign(wallCenter[0]) * normalOffsetM,
          yM,
          -sideRunHalfM + mmToM(runMm)
        );
      }
      mesh.name = name;
      mesh.userData.doorId = door.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.doorMeshes.push(mesh);
      return mesh;
    };

    const jambHeightM = doorHeightM;
    const frameDepthM = thicknessM + 0.025;
    createBox('door-frame-left', door.offsetMm + frameMm / 2, floorBaseM + jambHeightM / 2, frameMm, jambHeightM, frameDepthM, 0, this.doorFrameMaterial);
    createBox('door-frame-right', door.offsetMm + door.widthMm - frameMm / 2, floorBaseM + jambHeightM / 2, frameMm, jambHeightM, frameDepthM, 0, this.doorFrameMaterial);
    createBox('door-frame-header', door.offsetMm + door.widthMm / 2, floorBaseM + mmToM(door.heightMm - frameMm / 2), door.widthMm, mmToM(frameMm), frameDepthM, 0, this.doorFrameMaterial);

    const leafWidthMm = Math.max(100, door.widthMm - 2 * frameMm);
    const leafHeightM = Math.max(0.1, doorHeightM - mmToM(frameMm));
    const leafDepthM = 0.045;
    const isHinged = door.doorType === 'hinged';
    const hingeRunMm = isHinged
      ? door.offsetMm + (door.hingeSide === 'right' ? door.widthMm : 0)
      : door.offsetMm + door.widthMm / 2;
    const outwardNormalM = thicknessM / 2 + leafDepthM / 2 + 0.01;
    const pivot = new THREE.Group();
    const pivotPosition = door.wall === 'north' || door.wall === 'south'
      ? [-halfLengthM + mmToM(hingeRunMm), floorBaseM, wallCenter[1] + Math.sign(wallCenter[1]) * outwardNormalM]
      : [wallCenter[0] + Math.sign(wallCenter[0]) * outwardNormalM, floorBaseM, -sideRunHalfM + mmToM(hingeRunMm)];
    pivot.position.set(...pivotPosition);
    pivot.rotation.y = wallRotationY;
    const leafMesh = new THREE.Mesh(
      new THREE.BoxGeometry(mmToM(leafWidthMm), leafHeightM, leafDepthM),
      this.doorLeafMaterial
    );
    const localDirection = door.hingeSide === 'right' ? -axisSign : axisSign;
    leafMesh.position.set(localDirection * mmToM(leafWidthMm) / 2, leafHeightM / 2, 0);
    leafMesh.userData.doorId = door.id;
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    pivot.add(leafMesh);
    if (isHinged) {
      const swingSign = door.swingDirection === 'in' ? 1 : -1;
      pivot.rotation.y += swingSign * localDirection * 0.35;
    } else {
      leafMesh.position.set(0, leafHeightM / 2, 0);
    }
    group.add(pivot);
    this.doorMeshes.push(leafMesh);

    const handleRunMm = door.offsetMm + door.widthMm * (door.hingeSide === 'right' ? 0.78 : 0.22);
    createBox('door-handle', handleRunMm, floorBaseM + doorHeightM * 0.52, 35, mmToM(110), mmToM(45), outwardNormalM + 0.025, this.doorHandleMaterial);

    if (roomConfig.targetTemperatureC <= 0) {
      createBox('heated-threshold', door.offsetMm + door.widthMm / 2, floorBaseM + 0.018, door.widthMm, mmToM(36), thicknessM + 0.08, 0.015, this.heatedSillMaterial);
    }

    return group;
  }

  createEquipmentMesh(equipment) {
    const widthM = mmToM(equipment.sizeMm.width);
    const depthM = mmToM(equipment.sizeMm.depth);
    const heightM = mmToM(equipment.sizeMm.height);
    const geometry = new THREE.BoxGeometry(widthM, heightM, depthM);
    const material = new THREE.MeshStandardMaterial({
      color: equipment.color ?? '#94a3b8',
      roughness: 0.55,
      metalness: 0.18,
      wireframe: this.currentShowWireframe ?? false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      mmToM(equipment.positionMm.x),
      mmToM(equipment.positionMm.y),
      mmToM(equipment.positionMm.z)
    );
    mesh.rotation.y = (equipment.rotationYDeg * Math.PI) / 180;
    mesh.userData.equipmentId = equipment.id;
    mesh.userData.disposeMaterial = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.equipmentMeshes.push(mesh);
    return mesh;
  }
}

