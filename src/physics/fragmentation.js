import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";
import { randomInt, randomRange } from "../utils/random.js";
import { safeNormal } from "../utils/math.js";

const { Body } = Matter;

const BREAK_COOLDOWN_MS = 300;
const BASE_IMPULSE_THRESHOLD = 80;
const MIN_BREAKABLE_AREA = 650;
const MIN_FRAGMENT_AREA = 120;
const MAX_FRAGMENT_DEPTH = 2;

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function polygonArea(vertices) {
  if (!vertices || vertices.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) * 0.5;
}

function polygonBounds(vertices) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const vertex of vertices) {
    if (vertex.x < minX) {
      minX = vertex.x;
    }
    if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    }
    if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function almostSamePoint(a, b, epsilon = 0.4) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= epsilon;
}

function dedupePolygon(vertices) {
  if (vertices.length < 2) {
    return vertices;
  }

  const deduped = [];
  for (const vertex of vertices) {
    const prev = deduped[deduped.length - 1];
    if (!prev || !almostSamePoint(prev, vertex)) {
      deduped.push(vertex);
    }
  }

  if (deduped.length > 2 && almostSamePoint(deduped[0], deduped[deduped.length - 1])) {
    deduped.pop();
  }

  return deduped;
}

function clipPolygonWithHalfPlane(polygon, normal, offset) {
  if (!polygon || polygon.length < 3) {
    return [];
  }

  const clipped = [];
  const epsilon = 1e-6;

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currentDistance = dot(normal, current) - offset;
    const nextDistance = dot(normal, next) - offset;
    const currentInside = currentDistance <= epsilon;
    const nextInside = nextDistance <= epsilon;

    if (currentInside && nextInside) {
      clipped.push(next);
      continue;
    }

    if (currentInside && !nextInside) {
      const denominator = currentDistance - nextDistance;
      if (Math.abs(denominator) > epsilon) {
        const t = currentDistance / denominator;
        clipped.push({
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t
        });
      }
      continue;
    }

    if (!currentInside && nextInside) {
      const denominator = currentDistance - nextDistance;
      if (Math.abs(denominator) > epsilon) {
        const t = currentDistance / denominator;
        clipped.push({
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t
        });
      }
      clipped.push(next);
    }
  }

  return dedupePolygon(clipped);
}

function pointInPolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crossesY = (a.y > point.y) !== (b.y > point.y);
    if (!crossesY) {
      continue;
    }

    const intersectX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + 1e-9) + a.x;
    if (point.x < intersectX) {
      inside = !inside;
    }
  }

  return inside;
}

function randomPointInPolygon(polygon, bounds, center) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const x = randomRange(bounds.minX, bounds.maxX);
    const y = randomRange(bounds.minY, bounds.maxY);
    const point = { x, y };
    if (pointInPolygon(point, polygon)) {
      return point;
    }
  }

  return {
    x: center.x + randomRange(-bounds.width * 0.2, bounds.width * 0.2),
    y: center.y + randomRange(-bounds.height * 0.2, bounds.height * 0.2)
  };
}

function generateSites(basePolygon, count, center) {
  const bounds = polygonBounds(basePolygon);
  const sites = [center];

  while (sites.length < count) {
    sites.push(randomPointInPolygon(basePolygon, bounds, center));
  }

  return sites;
}

function createVoronoiFragments(basePolygon, pieceCount, center) {
  const sites = generateSites(basePolygon, pieceCount, center);
  const cells = [];

  for (let i = 0; i < sites.length; i += 1) {
    const site = sites[i];
    let cell = basePolygon.map((vertex) => ({ x: vertex.x, y: vertex.y }));

    for (let j = 0; j < sites.length; j += 1) {
      if (i === j || cell.length < 3) {
        continue;
      }

      const other = sites[j];
      const normal = { x: other.x - site.x, y: other.y - site.y };
      if (Math.abs(normal.x) + Math.abs(normal.y) < 1e-6) {
        continue;
      }

      const midpoint = {
        x: (site.x + other.x) * 0.5,
        y: (site.y + other.y) * 0.5
      };
      const offset = dot(normal, midpoint);
      cell = clipPolygonWithHalfPlane(cell, normal, offset);
    }

    if (cell.length >= 3 && polygonArea(cell) >= MIN_FRAGMENT_AREA) {
      cells.push(cell);
    }
  }

  return cells;
}

function createRadialFallbackFragments(center, basePolygon, pieceCount) {
  let maxRadius = 14;
  for (const vertex of basePolygon) {
    maxRadius = Math.max(maxRadius, Math.hypot(vertex.x - center.x, vertex.y - center.y));
  }

  const step = (Math.PI * 2) / pieceCount;
  const fragments = [];

  for (let i = 0; i < pieceCount; i += 1) {
    const startAngle = i * step + randomRange(-step * 0.12, step * 0.12);
    const endAngle = (i + 1) * step + randomRange(-step * 0.12, step * 0.12);
    const midAngle = (startAngle + endAngle) * 0.5;

    const innerRadius = randomRange(maxRadius * 0.08, maxRadius * 0.24);
    const outerA = randomRange(maxRadius * 0.56, maxRadius * 0.98);
    const outerMid = randomRange(maxRadius * 0.58, maxRadius * 1.0);
    const outerB = randomRange(maxRadius * 0.56, maxRadius * 0.98);

    const polygon = [
      {
        x: center.x + Math.cos(midAngle) * innerRadius,
        y: center.y + Math.sin(midAngle) * innerRadius
      },
      {
        x: center.x + Math.cos(startAngle) * outerA,
        y: center.y + Math.sin(startAngle) * outerA
      },
      {
        x: center.x + Math.cos(midAngle) * outerMid,
        y: center.y + Math.sin(midAngle) * outerMid
      },
      {
        x: center.x + Math.cos(endAngle) * outerB,
        y: center.y + Math.sin(endAngle) * outerB
      }
    ];

    if (polygonArea(polygon) >= MIN_FRAGMENT_AREA) {
      fragments.push(polygon);
    }
  }

  return fragments;
}

function impulseThreshold(body) {
  const meta = body.plugin?.custom;
  const durability = meta?.durability ?? 1;
  const strengthFactor = Math.pow(Math.max(0.3, meta?.strengthFactor ?? 1), 1.6);
  const depthFactor = 1 + (meta?.fragmentDepth ?? 0) * 0.35;
  return BASE_IMPULSE_THRESHOLD * durability * depthFactor * strengthFactor;
}

function scaleVector(vector, scalar) {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar
  };
}

export function createFragmentationSystem({ objectManager }) {
  function canBreak(body) {
    const meta = body?.plugin?.custom;
    if (!meta || meta.removed || body.isStatic) {
      return false;
    }

    if (!meta.breakable || (meta.fragmentDepth ?? 0) >= MAX_FRAGMENT_DEPTH) {
      return false;
    }

    if (body.area < MIN_BREAKABLE_AREA) {
      return false;
    }

    return true;
  }

  function createFragmentPieces(body, pieceCount, center) {
    const sourcePolygon = body.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
    const voronoiPieces = createVoronoiFragments(sourcePolygon, pieceCount, center);
    if (voronoiPieces.length >= 3) {
      return voronoiPieces;
    }

    return createRadialFallbackFragments(center, sourcePolygon, pieceCount);
  }

  function tryBreak(body, impulse, direction) {
    if (!canBreak(body)) {
      return false;
    }

    const meta = body.plugin.custom;
    const now = performance.now();
    if (now - (meta.lastBreakAt ?? 0) < BREAK_COOLDOWN_MS) {
      return false;
    }

    if (impulse < impulseThreshold(body)) {
      return false;
    }

    const center = { x: body.position.x, y: body.position.y };
    const pieceCount = randomInt(3, 8);
    const fragmentPieces = createFragmentPieces(body, pieceCount, center);
    if (fragmentPieces.length < 2) {
      return false;
    }

    meta.lastBreakAt = now;
    objectManager.removeBody(body);

    const fragmentDepth = (meta.fragmentDepth ?? 0) + 1;
    const baseDirection = safeNormal(direction ?? { x: 0, y: 0 });

    for (const vertices of fragmentPieces) {
      const fragment = objectManager.createFragment(vertices, meta.color, fragmentDepth);
      if (!fragment) {
        continue;
      }

      const outward = safeNormal({
        x: fragment.position.x - center.x,
        y: fragment.position.y - center.y
      });

      const pushStrength = Math.max(0.00045, impulse * 0.000008);
      Body.applyForce(fragment, fragment.position, {
        x: (outward.x + baseDirection.x * 0.75) * pushStrength * fragment.mass,
        y: (outward.y + baseDirection.y * 0.75) * pushStrength * fragment.mass
      });
    }

    return true;
  }

  function handleCollisionPair(pair) {
    const { bodyA, bodyB } = pair;
    const staticCollision = bodyA.isStatic || bodyB.isStatic;
    const relativeSpeed = Math.hypot(
      bodyA.velocity.x - bodyB.velocity.x,
      bodyA.velocity.y - bodyB.velocity.y
    );
    const directionAToB = safeNormal({
      x: bodyA.position.x - bodyB.position.x,
      y: bodyA.position.y - bodyB.position.y
    });

    if (staticCollision) {
      if (relativeSpeed < 16) {
        return;
      }

      const dynamicBody = bodyA.isStatic ? bodyB : bodyA;
      const dynamicDirection =
        dynamicBody === bodyA ? directionAToB : scaleVector(directionAToB, -1);
      const collisionImpulse = relativeSpeed * relativeSpeed * 0.62;
      tryBreak(dynamicBody, collisionImpulse, dynamicDirection);
      return;
    }

    if (relativeSpeed < 12) {
      return;
    }

    const collisionImpulse = relativeSpeed * relativeSpeed * 0.52;
    tryBreak(bodyA, collisionImpulse, directionAToB);
    tryBreak(bodyB, collisionImpulse, scaleVector(directionAToB, -1));
  }

  return {
    tryBreak,
    handleCollisionPair
  };
}
