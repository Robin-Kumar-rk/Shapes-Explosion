import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.mjs";

function regularPolygonPoints(sides, radius) {
  const points = [];
  const step = (Math.PI * 2) / sides;

  for (let i = 0; i < sides; i += 1) {
    const angle = i * step;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  return points;
}

export function drawRenderSpec(graphics, renderSpec, color, alpha = 1) {
  if (!renderSpec) {
    return;
  }

  graphics.clear();
  graphics.beginFill(color, alpha);

  if (renderSpec.type === "rect") {
    graphics.drawRect(
      -renderSpec.width * 0.5,
      -renderSpec.height * 0.5,
      renderSpec.width,
      renderSpec.height
    );
  } else if (renderSpec.type === "circle") {
    graphics.drawCircle(0, 0, renderSpec.radius);
  } else if (renderSpec.type === "regularPolygon") {
    graphics.drawPolygon(regularPolygonPoints(renderSpec.sides, renderSpec.radius));
  } else if (renderSpec.type === "customPolygon" && renderSpec.vertices.length > 2) {
    graphics.moveTo(renderSpec.vertices[0].x, renderSpec.vertices[0].y);
    for (let i = 1; i < renderSpec.vertices.length; i += 1) {
      graphics.lineTo(renderSpec.vertices[i].x, renderSpec.vertices[i].y);
    }
    graphics.closePath();
  }

  graphics.endFill();
}

function createBodyGraphic(body) {
  const meta = body.plugin?.custom;
  if (!meta?.render) {
    return null;
  }

  const graphics = new PIXI.Graphics();
  drawRenderSpec(graphics, meta.render, meta.color, 1);

  if (meta.kind === "bomb") {
    const fuse = new PIXI.Graphics();
    fuse.lineStyle(2, 0xffffff, 0.9);
    fuse.moveTo(0, -meta.render.radius * 0.9);
    fuse.lineTo(0, -meta.render.radius * 1.5);
    fuse.beginFill(0xfff17a);
    fuse.drawCircle(0, -meta.render.radius * 1.6, 2);
    fuse.endFill();
    graphics.addChild(fuse);
  }

  graphics.position.set(body.position.x, body.position.y);
  graphics.rotation = body.angle;
  return graphics;
}

export function createSyncSystem(objectLayer) {
  const bodyToGraphic = new Map();

  function addBody(body) {
    if (bodyToGraphic.has(body)) {
      return;
    }

    const graphic = createBodyGraphic(body);
    if (!graphic) {
      return;
    }

    objectLayer.addChild(graphic);
    bodyToGraphic.set(body, graphic);
  }

  function removeBody(body) {
    const graphic = bodyToGraphic.get(body);
    if (!graphic) {
      return;
    }

    bodyToGraphic.delete(body);
    graphic.destroy({ children: true });
  }

  function sync() {
    for (const [body, graphic] of bodyToGraphic.entries()) {
      const meta = body.plugin?.custom;
      if (!meta || meta.removed) {
        removeBody(body);
        continue;
      }

      graphic.position.set(body.position.x, body.position.y);
      graphic.rotation = body.angle;
    }
  }

  return {
    addBody,
    removeBody,
    sync
  };
}
