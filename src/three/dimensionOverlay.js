import * as THREE from 'three';
import { mmToM } from '../logic/calculations.js';

/**
 * Projects 3D room coordinates to 2D screen pixel coordinates
 * to render sharp HTML dimension badges on top of the canvas.
 */
export class DimensionOverlay {
  constructor(containerElement, camera) {
    this.container = containerElement;
    this.camera = camera;
    this.tempVector = new THREE.Vector3();

    // DOM Badges
    this.badgeLength = document.createElement('div');
    this.badgeLength.className = 'dimension-badge dimension-length';
    this.container.appendChild(this.badgeLength);

    this.badgeWidth = document.createElement('div');
    this.badgeWidth.className = 'dimension-badge dimension-width';
    this.container.appendChild(this.badgeWidth);

    this.badgeHeight = document.createElement('div');
    this.badgeHeight.className = 'dimension-badge dimension-height';
    this.container.appendChild(this.badgeHeight);

    this.visible = true;
  }

  update(roomConfig, showDimensions, canvas) {
    if (!showDimensions) {
      this.badgeLength.style.display = 'none';
      this.badgeWidth.style.display = 'none';
      this.badgeHeight.style.display = 'none';
      return;
    }

    this.badgeLength.style.display = 'block';
    this.badgeWidth.style.display = 'block';
    this.badgeHeight.style.display = 'block';

    const { length, width, height } = roomConfig.dimensions;
    const lengthM = mmToM(length);
    const widthM = mmToM(width);
    const heightM = mmToM(height);

    const halfL = lengthM / 2;
    const halfW = widthM / 2;

    this.badgeLength.textContent = `↔ ${length.toLocaleString()} mm`;
    this.badgeWidth.textContent = `↕ ${width.toLocaleString()} mm`;
    this.badgeHeight.textContent = `⤢ ${height.toLocaleString()} mm`;

    const rect = canvas.getBoundingClientRect();

    // Position Length Badge (front edge)
    this.positionBadge(this.badgeLength, 0, 0.1, halfW + 0.35, rect);

    // Position Width Badge (right edge)
    this.positionBadge(this.badgeWidth, halfL + 0.35, 0.1, 0, rect);

    // Position Height Badge (corner edge)
    this.positionBadge(this.badgeHeight, -halfL - 0.25, heightM / 2, halfW + 0.25, rect);
  }

  positionBadge(element, worldX, worldY, worldZ, rect) {
    this.tempVector.set(worldX, worldY, worldZ);
    this.tempVector.project(this.camera);

    // Don't show if behind camera
    if (this.tempVector.z > 1) {
      element.style.display = 'none';
      return;
    }

    const x = (this.tempVector.x * 0.5 + 0.5) * rect.width;
    const y = (-(this.tempVector.y * 0.5) + 0.5) * rect.height;

    element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }
}

