import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.mjs";
import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";
import { computeDragShape } from "../physics/objects.js";
import { drawRenderSpec } from "../render/sync.js";
import { toColorNumber } from "../utils/math.js";

const { Query } = Matter;

export function createInputController({
  canvas,
  previewLayer,
  getPointerPosition,
  getSelectedShape,
  getSelectedColor,
  getObjectStrength,
  isBombMode,
  isClearMode,
  getBodies,
  removeBody,
  createShape,
  createBomb
}) {
  const previewGraphic = new PIXI.Graphics();
  previewGraphic.visible = false;
  previewLayer.addChild(previewGraphic);

  let dragStart = null;
  let dragCurrent = null;
  let dragging = false;

  canvas.style.touchAction = "none";

  function resetPreview() {
    dragging = false;
    dragStart = null;
    dragCurrent = null;
    previewGraphic.visible = false;
    previewGraphic.clear();
    previewGraphic.position.set(0, 0);
    previewGraphic.rotation = 0;
  }

  function updatePreview() {
    if (!dragging || !dragStart || !dragCurrent) {
      resetPreview();
      return;
    }

    const shapeType = getSelectedShape();
    const spec = computeDragShape(shapeType, dragStart, dragCurrent, 2);
    if (!spec) {
      previewGraphic.visible = false;
      previewGraphic.clear();
      return;
    }

    const color = toColorNumber(getSelectedColor());
    drawRenderSpec(previewGraphic, spec, color, 0.35);
    previewGraphic.position.set(spec.x, spec.y);
    previewGraphic.rotation = spec.angle ?? 0;
    previewGraphic.visible = true;
  }

  function removeBodyAtPointer(pointer) {
    const bodies = getBodies();
    if (!bodies.length) {
      return;
    }

    const hits = Query.point(bodies, pointer);
    if (!hits.length) {
      return;
    }

    const target = hits
      .slice()
      .sort(
        (a, b) =>
          (b.plugin?.custom?.createdAt ?? 0) - (a.plugin?.custom?.createdAt ?? 0)
      )[0];
    if (target) {
      removeBody(target);
    }
  }

  function onMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    const pointer = getPointerPosition(event);

    if (isClearMode()) {
      removeBodyAtPointer(pointer);
      return;
    }

    if (isBombMode()) {
      createBomb(pointer);
      return;
    }

    dragging = true;
    dragStart = pointer;
    dragCurrent = pointer;
    updatePreview();
  }

  function onMouseMove(event) {
    if (!dragging) {
      return;
    }

    dragCurrent = getPointerPosition(event);
    updatePreview();
  }

  function onMouseUp(event) {
    if (event.button !== 0 || !dragging || !dragStart || !dragCurrent) {
      return;
    }

    dragCurrent = getPointerPosition(event);
    const shapeType = getSelectedShape();
    const color = toColorNumber(getSelectedColor());
    const strength = getObjectStrength();
    createShape({
      shapeType,
      start: dragStart,
      end: dragCurrent,
      color,
      strength
    });

    resetPreview();
  }

  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", resetPreview);

  return {
    destroy() {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", resetPreview);
      previewGraphic.destroy();
    }
  };
}
