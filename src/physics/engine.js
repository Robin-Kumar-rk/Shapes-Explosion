import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";

const { Engine, World, Bodies } = Matter;

const WALL_THICKNESS = 120;

function markBoundary(body) {
  body.plugin = body.plugin || {};
  body.plugin.custom = {
    kind: "boundary",
    removed: false
  };
  return body;
}

function createBoundaryBodies(width, height) {
  const floor = markBoundary(
    Bodies.rectangle(
      width * 0.5,
      height + WALL_THICKNESS * 0.5,
      width + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      { isStatic: true, friction: 0.9, restitution: 0.1 }
    )
  );

  const leftWall = markBoundary(
    Bodies.rectangle(
      -WALL_THICKNESS * 0.5,
      height * 0.5,
      WALL_THICKNESS,
      height * 2,
      { isStatic: true, friction: 0.9, restitution: 0.1 }
    )
  );

  const rightWall = markBoundary(
    Bodies.rectangle(
      width + WALL_THICKNESS * 0.5,
      height * 0.5,
      WALL_THICKNESS,
      height * 2,
      { isStatic: true, friction: 0.9, restitution: 0.1 }
    )
  );

  return [floor, leftWall, rightWall];
}

export function createPhysicsEngine(width, height) {
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1;
  engine.positionIterations = 8;
  engine.velocityIterations = 7;
  engine.constraintIterations = 3;

  const { world } = engine;
  let boundaries = createBoundaryBodies(width, height);
  World.add(world, boundaries);

  function resizeBoundaries(nextWidth, nextHeight) {
    for (const boundary of boundaries) {
      World.remove(world, boundary);
    }
    boundaries = createBoundaryBodies(nextWidth, nextHeight);
    World.add(world, boundaries);
  }

  return {
    engine,
    world,
    resizeBoundaries
  };
}
