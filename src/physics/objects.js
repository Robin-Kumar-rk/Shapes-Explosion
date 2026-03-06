import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";
import { clamp, midpoint } from "../utils/math.js";

const { Bodies, Body, World, Sleeping } = Matter;

const DEFAULT_BODY_OPTIONS = {
  density: 0.003,
  restitution: 0.2,
  friction: 0.8,
  frictionStatic: 0.9,
  frictionAir: 0.012
};

const BOMB_BODY_OPTIONS = {
  density: 0.0024,
  restitution: 0.35,
  friction: 0.55,
  frictionAir: 0.005
};

const FRAGMENT_BODY_OPTIONS = {
  density: 0.0025,
  restitution: 0.2,
  friction: 0.78,
  frictionAir: 0.016
};

const REGULAR_SHAPE_SIDES = {
  triangle: 3,
  pentagon: 5,
  hexagon: 6
};

const MIN_DRAG_DISTANCE = 4;
const DEFAULT_MIN_SIZE = 14;
const BOMB_RADIUS = 14;
const LINEAR_DAMPING_PER_SECOND = 0.035;
const ANGULAR_DAMPING_PER_SECOND = 0.035;

function makeRenderSpec(spec, body) {
  if (spec.type === "customPolygon" || spec.type === "regularPolygon") {
    const localVertices = body.vertices.map((vertex) => ({
      x: vertex.x - body.position.x,
      y: vertex.y - body.position.y
    }));

    return {
      type: "customPolygon",
      vertices: localVertices
    };
  }

  if (spec.type === "rect") {
    return {
      type: "rect",
      width: spec.width,
      height: spec.height
    };
  }

  if (spec.type === "circle") {
    return {
      type: "circle",
      radius: spec.radius
    };
  }

  return null;
}

function attachMetadata(body, color, metaConfig, render) {
  body.plugin = body.plugin || {};
  body.plugin.custom = {
    kind: metaConfig.kind,
    color,
    breakable: metaConfig.breakable,
    durability: metaConfig.durability ?? 1,
    strengthFactor: metaConfig.strengthFactor ?? 1,
    fragmentDepth: metaConfig.fragmentDepth ?? 0,
    fuseMsRemaining: metaConfig.fuseMsRemaining ?? 0,
    createdAt: performance.now(),
    removed: false,
    render
  };
}

function createBodyFromSpec(spec, color, metaConfig, optionOverrides = {}) {
  const options = { ...DEFAULT_BODY_OPTIONS, ...optionOverrides };
  let body = null;

  if (spec.type === "rect") {
    body = Bodies.rectangle(spec.x, spec.y, spec.width, spec.height, options);
    if (spec.angle) {
      Body.setAngle(body, spec.angle);
    }
  } else if (spec.type === "circle") {
    body = Bodies.circle(spec.x, spec.y, spec.radius, options);
  } else if (spec.type === "regularPolygon") {
    body = Bodies.polygon(spec.x, spec.y, spec.sides, spec.radius, options);
    const sideAlignedAngle = spec.sides % 2 === 0 ? Math.PI / spec.sides : 0;
    const initialAngle =
      typeof spec.angle === "number"
        ? spec.angle
        : sideAlignedAngle + (Math.random() - 0.5) * 0.08;
    if (Math.abs(initialAngle) > 1e-6) {
      Body.setAngle(body, initialAngle);
    }
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.02);
  } else if (spec.type === "customPolygon") {
    body = Bodies.fromVertices(spec.x, spec.y, [spec.vertices], options, true);
    if (Array.isArray(body)) {
      body = body[0];
    }
    if (!body) {
      body = Bodies.polygon(spec.x, spec.y, 3, 10, options);
    }
  }

  if (!body) {
    return null;
  }

  attachMetadata(body, color, metaConfig, makeRenderSpec(spec, body));
  return body;
}

function centroid(vertices) {
  let sumX = 0;
  let sumY = 0;
  for (const vertex of vertices) {
    sumX += vertex.x;
    sumY += vertex.y;
  }

  return {
    x: sumX / vertices.length,
    y: sumY / vertices.length
  };
}

export function computeDragShape(shapeType, start, end, minSize = DEFAULT_MIN_SIZE) {
  if (!start || !end) {
    return null;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dragDistance = Math.hypot(dx, dy);

  if (dragDistance < MIN_DRAG_DISTANCE) {
    return null;
  }

  const center = midpoint(start, end);
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (shapeType === "rectangle") {
    return {
      type: "rect",
      x: center.x,
      y: center.y,
      width: Math.max(absDx, minSize),
      height: Math.max(absDy, minSize)
    };
  }

  if (shapeType === "circle") {
    return {
      type: "circle",
      x: center.x,
      y: center.y,
      radius: Math.max(absDx, absDy, minSize) * 0.5
    };
  }

  if (shapeType in REGULAR_SHAPE_SIDES) {
    return {
      type: "regularPolygon",
      x: center.x,
      y: center.y,
      sides: REGULAR_SHAPE_SIDES[shapeType],
      radius: Math.max(absDx, absDy, minSize) * 0.5
    };
  }

  if (shapeType === "bar") {
    const length = Math.max(dragDistance, minSize * 2);
    const thickness = clamp(length * 0.12, 10, 22);
    return {
      type: "rect",
      x: center.x,
      y: center.y,
      width: length,
      height: thickness,
      angle: Math.atan2(dy, dx)
    };
  }

  return null;
}

export function createObjectManager({
  world,
  onBodyAdded,
  onBodyRemoved,
  maxObjects = 200,
  trimIntervalMs = 120
}) {
  const managedBodies = [];
  let lastTrimAt = 0;

  function addManagedBody(body) {
    if (!body) {
      return null;
    }

    managedBodies.push(body);
    World.add(world, body);
    onBodyAdded?.(body);
    return body;
  }

  function removeBody(body) {
    if (!body?.plugin?.custom || body.plugin.custom.removed) {
      return;
    }

    body.plugin.custom.removed = true;
    World.remove(world, body);

    const index = managedBodies.indexOf(body);
    if (index >= 0) {
      managedBodies.splice(index, 1);
    }

    // Wake nearby/sleeping bodies so stacks re-evaluate immediately after removals.
    for (const candidate of managedBodies) {
      const meta = candidate?.plugin?.custom;
      if (!meta || meta.removed || candidate.isStatic) {
        continue;
      }
      Sleeping.set(candidate, false);
    }

    onBodyRemoved?.(body);
  }

  function getBodies() {
    return managedBodies.filter((body) => !body.plugin?.custom?.removed);
  }

  function getBodiesByKind(kind) {
    return getBodies().filter((body) => body.plugin?.custom?.kind === kind);
  }

  function createShapeFromDrag(
    shapeType,
    start,
    end,
    color,
    shapeStrength = 1,
    unbreakable = false
  ) {
    const spec = computeDragShape(shapeType, start, end);
    if (!spec) {
      return null;
    }

    const shapeOptions =
      spec.type === "regularPolygon"
        ? { ...DEFAULT_BODY_OPTIONS, friction: 0.5, frictionStatic: 0.55 }
        : DEFAULT_BODY_OPTIONS;

    return addManagedBody(
      createBodyFromSpec(
        spec,
        color,
        {
          kind: "shape",
          breakable: !unbreakable,
          durability: unbreakable ? 8 : 1.8,
          strengthFactor: unbreakable ? 5 : Math.max(0.3, shapeStrength),
          fragmentDepth: 0
        },
        shapeOptions
      )
    );
  }

  function createBomb(x, y) {
    const spec = {
      type: "circle",
      x,
      y,
      radius: BOMB_RADIUS
    };

    return addManagedBody(
      createBodyFromSpec(
        spec,
        0xff5a5a,
        {
          kind: "bomb",
          breakable: false,
          durability: 4,
          fragmentDepth: 0,
          fuseMsRemaining: 2500
        },
        BOMB_BODY_OPTIONS
      )
    );
  }

  function createFragment(vertices, color, fragmentDepth) {
    if (!vertices || vertices.length < 3) {
      return null;
    }

    const center = centroid(vertices);
    const spec = {
      type: "customPolygon",
      x: center.x,
      y: center.y,
      vertices
    };

    return addManagedBody(
      createBodyFromSpec(
        spec,
        color,
        {
          kind: "fragment",
          breakable: fragmentDepth < 2,
          durability: Math.max(0.95, 1.25 - fragmentDepth * 0.2),
          fragmentDepth
        },
        FRAGMENT_BODY_OPTIONS
      )
    );
  }

  function enforceObjectLimit(nowMs) {
    const activeBodies = getBodies();
    if (activeBodies.length <= maxObjects) {
      return;
    }

    if (nowMs - lastTrimAt < trimIntervalMs) {
      return;
    }

    const oldestBody = activeBodies
      .slice()
      .sort((a, b) => a.plugin.custom.createdAt - b.plugin.custom.createdAt)[0];

    if (oldestBody) {
      removeBody(oldestBody);
      lastTrimAt = nowMs;
    }
  }

  function clearAll() {
    const bodies = getBodies().slice();
    for (const body of bodies) {
      removeBody(body);
    }
  }

  function applyEnergyLoss(deltaMs) {
    if (deltaMs <= 0) {
      return;
    }

    const seconds = deltaMs / 1000;
    const linearFactor = Math.exp(-LINEAR_DAMPING_PER_SECOND * seconds);
    const angularFactor = Math.exp(-ANGULAR_DAMPING_PER_SECOND * seconds);

    for (const body of managedBodies) {
      const meta = body.plugin?.custom;
      if (!meta || meta.removed || body.isStatic || body.isSleeping) {
        continue;
      }

      const nextVelocity = {
        x: body.velocity.x * linearFactor,
        y: body.velocity.y * linearFactor
      };
      const nextAngularVelocity = body.angularVelocity * angularFactor;

      const speedSq = nextVelocity.x * nextVelocity.x + nextVelocity.y * nextVelocity.y;
      if (speedSq < 0.0009) {
        nextVelocity.x = 0;
        nextVelocity.y = 0;
      }

      if (Math.abs(nextAngularVelocity) < 0.0008) {
        Body.setAngularVelocity(body, 0);
      } else {
        Body.setAngularVelocity(body, nextAngularVelocity);
      }

      Body.setVelocity(body, nextVelocity);
    }
  }

  return {
    createShapeFromDrag,
    createBomb,
    createFragment,
    getBodies,
    getBodiesByKind,
    removeBody,
    clearAll,
    enforceObjectLimit,
    applyEnergyLoss
  };
}
