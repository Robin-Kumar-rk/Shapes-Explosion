import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";
import { createPhysicsEngine } from "./physics/engine.js";
import { createObjectManager } from "./physics/objects.js";
import { createFragmentationSystem } from "./physics/fragmentation.js";
import { createExplosionSystem } from "./physics/explosion.js";
import { createToolbar } from "./ui/toolbar.js";
import { createInputController } from "./ui/input.js";
import { createRenderer } from "./render/renderer.js";
import { createSyncSystem } from "./render/sync.js";

const renderer = createRenderer();
const { engine, world, resizeBoundaries } = createPhysicsEngine(window.innerWidth, window.innerHeight);
const syncSystem = createSyncSystem(renderer.objectLayer);
const toolbar = createToolbar();

const objectManager = createObjectManager({
  world,
  maxObjects: 200,
  onBodyAdded: (body) => syncSystem.addBody(body),
  onBodyRemoved: (body) => syncSystem.removeBody(body)
});

const fragmentation = createFragmentationSystem({ objectManager });
const explosionSystem = createExplosionSystem({
  objectManager,
  fragmentation,
  particleLayer: renderer.particleLayer,
  triggerShake: renderer.triggerShake
});

let paused = false;
let simulationSpeed = toolbar.getSpeed();
explosionSystem.setBombPower(toolbar.getBombPower());
engine.timing.timeScale = 1;

toolbar.onPauseChange((isPaused) => {
  paused = isPaused;
});

toolbar.onSpeedChange((speed) => {
  simulationSpeed = speed;
});

toolbar.onBombPowerChange((bombPower) => {
  explosionSystem.setBombPower(bombPower);
});

createInputController({
  canvas: renderer.app.view,
  previewLayer: renderer.previewLayer,
  getPointerPosition: renderer.getPointerPosition,
  getSelectedShape: toolbar.getSelectedShape,
  getSelectedColor: toolbar.getSelectedColor,
  getObjectStrength: toolbar.getObjectStrength,
  isBombMode: toolbar.isBombMode,
  isClearMode: toolbar.isClearMode,
  getBodies: objectManager.getBodies,
  removeBody: objectManager.removeBody,
  createShape: ({ shapeType, start, end, color, strength }) =>
    objectManager.createShapeFromDrag(shapeType, start, end, color, strength),
  createBomb: (position) => objectManager.createBomb(position.x, position.y)
});

Matter.Events.on(engine, "collisionStart", (event) => {
  for (const pair of event.pairs) {
    fragmentation.handleCollisionPair(pair);
  }
});

window.addEventListener("resize", () => {
  resizeBoundaries(window.innerWidth, window.innerHeight);
});

renderer.app.ticker.maxFPS = 60;

renderer.app.ticker.add((ticker) => {
  const deltaMs = Math.min(33.33, ticker.deltaMS || 16.67);
  const simDeltaMs = paused ? 0 : deltaMs * simulationSpeed;

  if (!paused) {
    Matter.Engine.update(engine, simDeltaMs);
    objectManager.applyEnergyLoss(simDeltaMs);
  }

  objectManager.enforceObjectLimit(performance.now());
  explosionSystem.update(simDeltaMs, deltaMs);
  syncSystem.sync();
  renderer.update(deltaMs);
});
