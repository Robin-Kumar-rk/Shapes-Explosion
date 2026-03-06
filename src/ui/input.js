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
  isUnbreakableMode,
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
  let activePointerId = null;
  const supportsPointerEvents = "PointerEvent" in window;

  canvas.style.touchAction = "none";

  function resetPreview() {
    dragging = false;
    dragStart = null;
    dragCurrent = null;
    previewGraphic.visible = false;
    previewGraphic.clear();
    previewGraphic.position.set(0, 0);
    previewGraphic.rotation = 0;
    activePointerId = null;
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

  function startDrag(pointer, pointerId) {
    activePointerId = pointerId;
    dragging = true;
    dragStart = pointer;
    dragCurrent = pointer;
    updatePreview();
  }

  function finishDrag(pointer, pointerId) {
    if (pointerId !== activePointerId || !dragging || !dragStart || !dragCurrent) {
      return;
    }

    dragCurrent = pointer;
    const shapeType = getSelectedShape();
    const color = toColorNumber(getSelectedColor());
    const strength = getObjectStrength();
    const unbreakable = isUnbreakableMode();
    createShape({
      shapeType,
      start: dragStart,
      end: dragCurrent,
      color,
      strength,
      unbreakable
    });

    resetPreview();
  }

  function releasePointerCapture(pointerId) {
    if (typeof pointerId !== "number") {
      return;
    }

    try {
      if (canvas.hasPointerCapture?.(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // Some browsers can throw if capture state changes before release.
    }
  }

  function beginAction(pointer, pointerId) {
    if (isClearMode()) {
      removeBodyAtPointer(pointer);
      return;
    }

    if (isBombMode()) {
      createBomb(pointer);
      return;
    }

    startDrag(pointer, pointerId);
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (event.isPrimary === false) {
      return;
    }

    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    const pointer = getPointerPosition(event);
    beginAction(pointer, event.pointerId);

    if (!dragging) {
      return;
    }

    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore capture errors for browser/device combinations that do not support it.
    }
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    dragCurrent = getPointerPosition(event);
    updatePreview();
  }

  function onPointerUp(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    releasePointerCapture(event.pointerId);
    finishDrag(getPointerPosition(event), event.pointerId);
  }

  function onPointerCancel(event) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    releasePointerCapture(event.pointerId);
    resetPreview();
  }

  function findTouchById(touchList, touchId) {
    for (let i = 0; i < touchList.length; i += 1) {
      const touch = touchList.item(i);
      if (touch && touch.identifier === touchId) {
        return touch;
      }
    }
    return null;
  }

  function onTouchStart(event) {
    if (activePointerId !== null) {
      return;
    }

    const touch = event.changedTouches.item(0);
    if (!touch) {
      return;
    }

    event.preventDefault();
    beginAction(getPointerPosition(touch), touch.identifier);
  }

  function onTouchMove(event) {
    if (!dragging || typeof activePointerId !== "number") {
      return;
    }

    const touch = findTouchById(event.touches, activePointerId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    dragCurrent = getPointerPosition(touch);
    updatePreview();
  }

  function onTouchEnd(event) {
    if (typeof activePointerId !== "number") {
      return;
    }

    const touch = findTouchById(event.changedTouches, activePointerId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    finishDrag(getPointerPosition(touch), touch.identifier);
  }

  function onTouchCancel(event) {
    if (typeof activePointerId !== "number") {
      return;
    }

    const touch = findTouchById(event.changedTouches, activePointerId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    resetPreview();
  }

  function onMouseDown(event) {
    if (event.button !== 0 || activePointerId !== null) {
      return;
    }

    event.preventDefault();
    beginAction(getPointerPosition(event), "mouse");
  }

  function onMouseMove(event) {
    if (!dragging || activePointerId !== "mouse") {
      return;
    }

    event.preventDefault();
    dragCurrent = getPointerPosition(event);
    updatePreview();
  }

  function onMouseUp(event) {
    if (event.button !== 0 || activePointerId !== "mouse") {
      return;
    }

    event.preventDefault();
    finishDrag(getPointerPosition(event), "mouse");
  }

  function onWindowBlur() {
    if (typeof activePointerId === "number") {
      releasePointerCapture(activePointerId);
    }
    resetPreview();
  }

  if (supportsPointerEvents) {
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  } else {
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchCancel, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  window.addEventListener("blur", onWindowBlur);

  return {
    destroy() {
      if (supportsPointerEvents) {
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
      } else {
        canvas.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchCancel);
        canvas.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.removeEventListener("blur", onWindowBlur);
      previewGraphic.destroy();
    }
  };
}
