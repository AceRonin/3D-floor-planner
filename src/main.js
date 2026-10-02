import { store } from './state.js';
import { SceneManager } from './three/sceneManager.js';
import { UIController } from './ui/uiController.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('three-canvas');
  const overlayContainer = document.getElementById('dimension-overlay');

  if (!canvas || !overlayContainer) {
    console.error('Required canvas or dimension overlay elements missing.');
    return;
  }

  // 1. Initialize Three.js 3D Viewport
  const sceneManager = new SceneManager(canvas, overlayContainer);

  // 2. Initialize 2D UI Controls
  const uiController = new UIController(sceneManager);

  // 3. Connect reactive store updates to Three.js and the UI
  store.subscribe((state) => {
    sceneManager.updateState(state.room, state.viewSettings);
    uiController.update(state);
  });
});

