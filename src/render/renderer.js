import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.mjs";

export function createRenderer() {
  const app = new PIXI.Application({
    backgroundColor: 0x000000,
    antialias: true,
    autoDensity: true,
    resolution: Math.max(window.devicePixelRatio || 1, 1),
    resizeTo: window
  });

  const mount = document.getElementById("appRoot");
  mount.appendChild(app.view);

  const worldContainer = new PIXI.Container();
  const objectLayer = new PIXI.Container();
  const particleLayer = new PIXI.Container();
  const previewLayer = new PIXI.Container();

  worldContainer.addChild(objectLayer, particleLayer, previewLayer);
  app.stage.addChild(worldContainer);

  let shakeRemainingMs = 0;
  let shakeDurationMs = 300;
  let shakeIntensity = 6;

  function triggerShake(durationMs = 300, intensity = 6) {
    shakeRemainingMs = Math.max(shakeRemainingMs, durationMs);
    shakeDurationMs = durationMs;
    shakeIntensity = intensity;
  }

  function update(deltaMs) {
    if (shakeRemainingMs > 0) {
      shakeRemainingMs = Math.max(0, shakeRemainingMs - deltaMs);
      const progress = shakeRemainingMs / shakeDurationMs;
      const amplitude = shakeIntensity * progress;
      worldContainer.x = (Math.random() - 0.5) * amplitude;
      worldContainer.y = (Math.random() - 0.5) * amplitude;
      return;
    }

    if (worldContainer.x !== 0 || worldContainer.y !== 0) {
      worldContainer.x = 0;
      worldContainer.y = 0;
    }
  }

  function getPointerPosition(event) {
    const rect = app.view.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - worldContainer.x,
      y: event.clientY - rect.top - worldContainer.y
    };
  }

  return {
    app,
    objectLayer,
    particleLayer,
    previewLayer,
    triggerShake,
    update,
    getPointerPosition
  };
}
