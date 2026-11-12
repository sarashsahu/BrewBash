# BrewBash

**BrewBash** is a fast-paced, responsive HTML5 Canvas highway arcade game built with vanilla HTML, CSS, and JavaScript (zero frameworks, zero build step). You pilot a sports car across a 4-lane highway where only 2 adjacent lanes are open at a time, weaving through falling beer bottles, traffic cones, oil spills, speed cameras, and slower AI traffic at speeds up to **400 km/h** (**450 km/h** under Nitro Boost).

---

## Project Structure

```text
BrewBash/
├── index.html                  # Game layout, HUD, start overlay, and Game Over modal
├── css/
│   └── style.css               # Borderless responsive styles for mobile & desktop
├── js/
│   └── script.js               # 60 FPS canvas engine, physics, AI traffic, FX & Web Audio
└── assets/
    ├── images/
    │   ├── car.png             # Player sports car sprite (180x360 RGBA)
    │   ├── beer.png            # Beer bottle obstacle sprite (82x280 RGBA)
    │   ├── cone.png            # Reflective traffic cone obstacle (184x220 RGBA)
    │   ├── oil.png             # Iridescent oil slick hazard (240x233 RGBA)
    │   ├── spanner.png         # Repair pickup (+25 HP, replaces heart) (213x220 RGBA)
    │   ├── lemon.png           # Lemon fresh boost (+10 HP, clears slip) (220x178 RGBA)
    │   └── shield.png          # Protective shield power-up (190x220 RGBA)
    └── audio/
        ├── crash.mp3           # Collision SFX
        ├── gameover.mp3        # Game Over SFX
        └── health.mp3          # Spanner pickup SFX
```

---

## Controls

| Action | Desktop (Keyboard) | Mobile / Touch |
| :--- | :--- | :--- |
| **Steer Left / Right** | `A` / `D` or `&larr;` / `&rarr;` | Hold `<` / `>` buttons or drag horizontally on the canvas |
| **Manual Speed Boost / Brake** | `W` / `S` or `&uarr;` / `&darr;` | Automatic dynamic speed curve |
| **Play / Pause** | `Space` or Play/Pause buttons | Tap Play / Pause buttons |
| **Restart Run** | Restart button / Try Again! | Tap Restart / Try Again! |
| **Mute / Unmute Sound & Hum** | Speaker toggle button | Tap Speaker toggle button |

---

## Architecture & Game Mechanics Explained

### 1. Responsive Sizing & Natural Sprite Aspect Ratios
On load and window resize, [`resizeCanvas()`](js/script.js) sizes the canvas to fit the viewport cleanly without external frame borders. Sprite dimensions scale proportionally with lane width and preserve each PNG's exact `naturalHeight / naturalWidth` ratio via [`bakeAspectSprite()`](js/script.js) so tall assets (like the `82x280` beer bottle) never stretch or compress.

```js
/** Bake an image preserving its natural height/width ratio for crisp arcade scaling. */
function bakeAspectSprite(img, targetW, fallbackRatio) {
    if (targetW <= 0) return null;
    const ratio = (img.complete && img.naturalWidth > 0) ? (img.naturalHeight / img.naturalWidth) : fallbackRatio;
    return bakeSprite(img, targetW, Math.max(1, Math.round(targetW * ratio)));
}
```

### 2. Zero-Lag Offscreen Caching & HUD Diffing
To eliminate mobile frame drops, static asphalt/divider tiles (`360px` tall in `roadTiles`), road signs (`signCache`), radar plates (`speedCamCache`), and sprites (`bakeAllSprites()`) are rendered once onto offscreen canvases and stamped each frame via `drawImage`. HUD DOM updates only fire when a displayed value changes, and the Pace/Health bars animate via GPU `transform: scaleX(...)` rather than triggering layout reflows:

```js
if (speedKmh !== lastHudSpeed) {
    lastHudSpeed = speedKmh;
    hudSpeed.textContent = nitroTimer > 0 ? `${speedKmh} km/h!` : `${speedKmh} km/h`;
    speedBarFill.style.transform = `scaleX(${Math.min(1, effSpeed / MAX_SPEED).toFixed(4)})`;
}
```

### 3. Randomized Speed Walk (Up to 400 km/h)
Rather than climbing monotonically until unplayable, [`pickNextSpeedTarget()`](js/script.js) shifts the car's baseline cruise speed up and down unpredictably within a score-advancing floor (`100` to `240 km/h`) and ceiling (up to `400 km/h`, `MAX_SPEED = 4.0`). Holding `W`/`Up` or `S`/`Down` temporarily offsets your speed before smoothly settling back to cruise pace.

```js
function pickNextSpeedTarget() {
    const floor = Math.min(2.4, 1.0 + (score / 6000) * 1.4);
    const ceil = Math.min(MAX_SPEED, 1.6 + (score / 4500) * 2.4);
    const mag = 0.15 + Math.random() * 0.4;
    let dir;
    if (autoSpeed >= ceil - 0.08) dir = -1;
    else if (autoSpeed <= floor + 0.08) dir = 1;
    else dir = Math.random() < (score < 4500 ? 0.58 : 0.5) ? 1 : -1;

    targetAutoSpeed = Math.max(floor, Math.min(ceil, autoSpeed + dir * mag));
    speedShiftTimer = 1800 + Math.random() * 2400;
}
```

### 4. Strictly Adjacent 2-Lane Road Diversions
The highway has 4 lanes, with 2 open at a time (`1 - 2`, `2 - 3`, or `3 - 4`, tracked by `activeStart` in `{0, 1, 2}`). When a roadwork diversion spawns in [`updateDiversion()`](js/script.js), the corridor always shifts by exactly one lane (`0 <-> 1 <-> 2`), never skipping straight from `1-2` to `3-4`. An overhead warning sign counts down distance in meters (`50m`, `30m`, etc.): merging cleanly awards `+100 x combo SAFE MERGE!`, while hitting the barricade deducts `25 HP`.

```js
// Shift only to physically adjacent 2-lane corridors: 0 <-> 1 <-> 2
const dir = activeStart === 0 ? 1 : (activeStart === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1));
const newStart = activeStart + dir;
```

### 5. Obstacles, AI Highway Traffic & Speed Cameras
- **Beer Bottles (`beer.png`) & Cones (`cone.png`):** Standard hazards (`-25 HP` on hit, `1.5s` blink invulnerability). Some beer bottles sway across the active corridor (`vx`).
- **Oil Spills (`oil.png`):** Causes `OIL SLIP!` for `950ms` (reduced steering grip + sideways drift), cleared instantly by collecting a Lemon or Nitro.
- **AI Traffic Cars ([`updateTraffic()`](js/script.js)):** Pre-baked blue coupes and yellow sedans cruise ahead at slower speeds (`0.44x–0.58x` road speed) with an escape lane always left open. They flash amber turn blinkers before smoothly sliding to the adjacent open lane, awarding `+75 x combo` on close overtakes (`-30 HP` on collision).
- **Speed Cameras ([`updateSpeedTrap()`](js/script.js)):** Spawn once speed passes `155 km/h` with a radar limit sign (`CAM MAX 180/200/220/240`). Passing under the limit earns `+150 x combo`; speeding triggers a white camera flash and `-100` points.

### 6. Pickups, Nitro Boost & Close-Call Combos
Pickups sway gently down open lanes via [`updateHealthDrop()`](js/script.js):
- **Spanner (`spanner.png`):** Restores `+25 HP`.
- **Lemon (`lemon.png`):** Clears `OIL SLIP!`, heals `+10 HP`, and awards `+100 x combo`.
- **Shield (`shield.png`):** Absorbs the next crash completely (`SHIELD SAVED!`).
- **Nitro Boost (`nitroTimer`):** Grants `5s` of flame exhaust, temporary top speed boost (`up to 450 km/h`), oil immunity, and lets you smash straight through bottles, cones, and AI traffic (`+100` to `+150 x combo SMASH!`).
- **Close-Call Combo (`combo = 1..4`):** Grazing past obstacles (`brewRadius + 14`) or traffic builds your multiplier up to `x4`.

```js
} else if (nitroTimer > 0 && rectCircleColliding(l.x, l.y, brewRadius + 4, carX, carY, carWidth, carHeight)) {
    l.checked = true;
    const pts = 100 * combo;
    score += pts;
    syncHighScore();
    spawnSparks(l.x, l.y, '#f97316', 10);
    addFloatText(l.x, l.y - 10, `+${pts} SMASH!`, '#fb923c');
```

### 7. Day/Night Cycle, Pooled FX, Web Audio & Run Summary
- **Atmosphere & Pooled FX:** [`updateFX()`](js/script.js) cycles lighting smoothly between day and night every `1,800` points, switching on translucent headlight beams in [`drawNightAndLights()`](js/script.js), rendering capped tire skid marks (`24`), square spark bursts (`28`), floating score popups (`6`), and high-speed wind streaks above `255 km/h`.
- **Web Audio + Engine Hum:** Audio clips are pre-decoded into Web Audio buffers where allowed, paired with synthesized arcade chimes (`playTone()`) and a continuous low-pass `sawtooth` engine hum whose pitch scales with `km/h` and stops cleanly on pause, mute, or Game Over.
- **Mobile Haptics & Persistent Stats:** Triggers subtle `navigator.vibrate` pulses on pickups, near misses, oil slips, and crashes, persists your all-time `Best` score in `localStorage` (`brewBashHighScore`), and summarizes **Distance (`km`)**, **Top Speed (`km/h`)**, and **Close Calls** on the Game Over card.

---

## Setup & Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sarashsahu/BrewBash.git
   cd BrewBash
   ```
2. **Run in your browser:**
   - Open `index.html` directly, **or**
   - Serve over any local static server (recommended so Web Audio `fetch()` pre-decoding works cleanly):
     ```bash
     python -m http.server 8080
     ```
     Then visit `http://localhost:8080`.

---

## Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature-name`).
3. Commit your changes cleanly (`git commit -m "Add your feature"`).
4. Push to your branch (`git push origin feature/your-feature-name`).
5. Open a Pull Request.

---

## Author

**Sarash Sahu**
- Instagram: [@sarashsahu](https://www.instagram.com/sarashsahu)
- LinkedIn: [sarashsahu](https://www.linkedin.com/in/sarashsahu)
