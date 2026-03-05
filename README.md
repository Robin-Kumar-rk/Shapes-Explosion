# Shapes Explosion - Physics Sandbox

Browser-based physics sandbox built with **PixiJS** (rendering) and **Matter.js** (physics).

You can draw shapes, place bombs, break objects into fragments, and tune simulation parameters in real time.

## Features

- Fullscreen black canvas with gravity and world boundaries
- Draw-to-create shapes: rectangle, circle, triangle, pentagon, hexagon, bar
- Live drag preview before shape creation
- Bomb tool with delayed explosion, particles, and screen shake
- Force-based fragmentation with irregular polygon shards
- Clear tool to remove selected objects by clicking them
- Pause/resume simulation
- Real physics speed control (`0.5x` to `2.0x`)
- Object strength control (`0.5x` to `2.5x`) applied per shape at creation time
- Bomb power control (`0.5x` to `2.5x`)
- Object limit protection (oldest objects are removed gradually)

## Run Locally

This is a static web project with CDN imports, so no build step is required.

1. Open a terminal in the project root.
2. Start a static server:

```powershell
python -m http.server 8080
```

3. Open:

`http://localhost:8080`

## Controls

- Shape bar: select shape icon, then click-drag-release on canvas
- Color picker: sets fill color for newly created shapes
- Bomb Tool: click canvas to spawn bomb
- Clear Tool: click an existing object to remove it
- Pause Physics: toggles physics stepping
- Speed slider: changes simulation timestep speed
- Strength slider: sets strength for future shapes only
- Bomb slider: changes explosion radius/force/fragment impulse/FX intensity

## Notes

- Strength is stored per object when it is created.
- Changing the strength slider does not retroactively update already spawned objects.
- Bombs use the current bomb power at detonation.

## Project Structure

```text
.
|-- index.html
|-- style.css
|-- README.md
`-- src/
    |-- main.js
    |-- physics/
    |   |-- engine.js
    |   |-- explosion.js
    |   |-- fragmentation.js
    |   `-- objects.js
    |-- render/
    |   |-- renderer.js
    |   `-- sync.js
    |-- ui/
    |   |-- input.js
    |   `-- toolbar.js
    `-- utils/
        |-- math.js
        `-- random.js
```