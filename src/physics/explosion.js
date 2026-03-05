import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";
import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.mjs";
import { randomInt, randomRange } from "../utils/random.js";
import { clamp, safeNormal } from "../utils/math.js";

const { Body } = Matter;

const EXPLOSION_RADIUS = 260;
const EXPLOSION_STRENGTH = 0.12;
const PARTICLE_CAP = 420;
const PARTICLE_GRAVITY = 260;

export function createExplosionSystem({
  objectManager,
  fragmentation,
  particleLayer,
  triggerShake
}) {
  const particles = [];
  let bombPowerMultiplier = 1;

  function removeParticle(index) {
    const particle = particles[index];
    particle.sprite.destroy();
    particles.splice(index, 1);
  }

  function clearParticles() {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      removeParticle(i);
    }
  }

  function spawnParticles(origin, power) {
    const minCount = Math.max(16, Math.round(18 + power * 10));
    const maxCount = Math.max(minCount + 2, Math.round(30 + power * 20));
    const count = randomInt(minCount, maxCount);

    for (let i = 0; i < count; i += 1) {
      if (particles.length >= PARTICLE_CAP) {
        removeParticle(0);
      }

      const particle = new PIXI.Graphics();
      const size = randomRange(1.8, 4.4);
      const lifeMs = randomRange(260, 560);
      const speed = randomRange(120 + power * 35, 360 + power * 170);
      const angle = randomRange(0, Math.PI * 2);
      const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      };
      const tint = randomRange(0, 1) > 0.5 ? 0xffc24d : 0xff7a59;

      particle.beginFill(tint, 1);
      particle.drawCircle(0, 0, size);
      particle.endFill();
      particle.position.set(origin.x, origin.y);
      particleLayer.addChild(particle);

      particles.push({
        sprite: particle,
        velocity,
        lifeMs,
        maxLifeMs: lifeMs
      });
    }
  }

  function updateParticles(deltaMs) {
    const deltaSeconds = deltaMs / 1000;

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.lifeMs -= deltaMs;
      if (particle.lifeMs <= 0) {
        removeParticle(i);
        continue;
      }

      particle.velocity.y += PARTICLE_GRAVITY * deltaSeconds;
      particle.sprite.x += particle.velocity.x * deltaSeconds;
      particle.sprite.y += particle.velocity.y * deltaSeconds;
      particle.sprite.alpha = clamp(particle.lifeMs / particle.maxLifeMs, 0, 1);
    }
  }

  function explodeAt(origin) {
    const power = bombPowerMultiplier;
    const effectiveRadius = EXPLOSION_RADIUS * (0.5 + power * 0.5);
    const effectiveStrength = EXPLOSION_STRENGTH * power;
    const bodies = objectManager.getBodies();

    for (const body of bodies) {
      const meta = body.plugin?.custom;
      if (!meta || meta.removed || body.isStatic) {
        continue;
      }

      const dx = body.position.x - origin.x;
      const dy = body.position.y - origin.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 1 || dist > effectiveRadius) {
        continue;
      }

      const falloff = 1 - dist / effectiveRadius;
      const forceMagnitude = effectiveStrength * falloff;
      const direction = safeNormal({ x: dx, y: dy - 0.18 * dist });

      Body.applyForce(body, body.position, {
        x: direction.x * forceMagnitude * body.mass,
        y: direction.y * forceMagnitude * body.mass
      });

      const impulse = forceMagnitude * 4200 * power;
      fragmentation.tryBreak(body, impulse, direction);
    }

    spawnParticles(origin, power);
    triggerShake?.(300 + power * 60, 7 + power * 4);
  }

  function detonateBomb(bombBody) {
    const origin = { x: bombBody.position.x, y: bombBody.position.y };
    objectManager.removeBody(bombBody);
    explodeAt(origin);
  }

  function update(simDeltaMs, renderDeltaMs) {
    if (simDeltaMs > 0) {
      const bombs = objectManager.getBodiesByKind("bomb");
      for (const bomb of bombs) {
        const meta = bomb.plugin.custom;
        meta.fuseMsRemaining -= simDeltaMs;
        if (meta.fuseMsRemaining <= 0) {
          detonateBomb(bomb);
        }
      }
    }

    updateParticles(renderDeltaMs);
  }

  return {
    setBombPower(value) {
      bombPowerMultiplier = Math.max(0.3, value);
    },
    update,
    explodeAt,
    clearParticles
  };
}
