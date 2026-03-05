export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function midpoint(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5
  };
}

export function safeNormal(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 1e-6) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

export function toColorNumber(colorValue) {
  if (typeof colorValue === "number") {
    return colorValue;
  }

  if (typeof colorValue !== "string") {
    return 0xffffff;
  }

  return Number.parseInt(colorValue.replace("#", ""), 16);
}
