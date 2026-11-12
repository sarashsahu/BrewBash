# BrewBash

**BrewBash** is a fast-paced, responsive HTML5 Canvas highway arcade game built with vanilla HTML, CSS, and JavaScript (zero frameworks, zero build step). You pilot a sports car across a 4-lane highway where 2 adjacent lanes are open at a time, weaving through falling beer bottles, traffic cones, and oil spills at speeds up to **400 km/h**.

---

## Project Structure

```text
BrewBash/
├── index.html                  # Game layout, HUD, start overlay, and Game Over modal
├── css/
│   └── style.css               # Borderless responsive styles for mobile & desktop
├── js/
│   └── script.js               # 60 FPS canvas engine, physics, pickups, FX & audio
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
| **Mute / Unmute Sound** | Speaker toggle button | Tap Speaker toggle button |

---

## Architecture & Game Mechanics Explained

### 1. Responsive Sizing & Natural Sprite Aspect Ratios
On load and window resize, [`resizeCanvas()`](js/script.js) sizes the canvas cleanly inside its borderless container (`canvasFrame`). Sprite dimensions scale proportionally with lane width and preserve each PNG's exact `naturalHeight / naturalWidth` ratio via [`bakeAspectSprite()`](js/script.js) so tall assets (like the `82x280` beer bottle) never stretch or compress.

```js
/** Bake an image preserving its natural height/width ratio for crisp arcade scaling. */
function bakeAspectSprite(img, targetW, fallbackRatio) {
    if (targetW <= 0) return null;
    const ratio = (img.complete && img.naturalWidth > 0) ? (img.naturalHeight / img.naturalWidth) : fallbackRatio;
    return bakeSprite(img, targetW, Math.max(1, Math.round(targetW * ratio)));
}
```

### 2. Zero-Lag Offscreen Caching & HUD Diffing
Static asphalt/divider tiles (`360px` tall in `roadTiles`), road signs (`signCache`), warning pills (`pillCache`), merge banners (`bannerCache`), and PNG sprites (`bakeAllSprites()`) are rendered once onto offscreen canvases and stamped each frame via `drawImage`. HUD DOM updates only fire when values change, and the Pace/Health bars animate via GPU `transform: scaleX(...)` without layout thrashing:

```js
if (speedKmh !== lastHudSpeed) {
    lastHudSpeed = speedKmh;
    hudSpeed.textContent = `${speedKmh} km/h`;
    speedBarFill.style.transform = `scaleX(${Math.min(1, gameSpeedMultiplier / MAX_SPEED).toFixed(4)})`;
}
```

### 3. Randomized Speed Walk (Up to 400 km/h)
[`pickNextSpeedTarget()`](js/script.js) shifts the baseline cruise speed up and down unpredictably within a score-advancing floor (`100` to `240 km/h`) and ceiling (up to `400 km/h`, `MAX_SPEED = 4.0`). Holding `W`/`Up` or `S`/`Down` temporarily boosts or slows speed before smoothly settling back to cruise pace.

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
The highway has 4 lanes, with 2 open at a time (`1 - 2`, `2 - 3`, or `3 - 4`, tracked by `activeStart` in `{0, 1, 2}`). When a diversion spawns in [`updateDiversion()`](js/script.js), the open corridor always shifts by one adjacent lane (`0 <-> 1 <-> 2`), never jumping straight from `1-2` to `3-4`. Merging smoothly past the countdown sign awards `+100 x combo SAFE MERGE!`; hitting the barricade deducts `25 HP`.

```js
// Shift only to physically adjacent 2-lane corridors: 0 <-> 1 <-> 2
const dir = activeStart === 0 ? 1 : (activeStart === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1));
const newStart = activeStart + dir;
```

### 5. Obstacles, Pickups & Close-Call Combos
- **Beer Bottles (`beer.png`) & Traffic Cones (`cone.png`):** Standard hazards (`-25 HP` on hit, `1.5s` blink invulnerability). Some beer bottles sway horizontally across the open corridor (`vx`).
- **Oil Spills (`oil.png`):** Causes `OIL SLIP!` for `950ms` (reduced steering grip + sideways drift).
- **Spanner (`spanner.png`):** Restores `+25 HP`.
- **Lemon (`lemon.png`):** Clears `OIL SLIP!`, restores `+10 HP`, and awards `+100 x combo`.
- **Shield (`shield.png`):** Draws a protective ring around the car and absorbs the next collision (`SHIELD SAVED!`).
- **Close-Call Combo (`combo = 1..4`):** Grazing past obstacles (`brewRadius + 14`) builds your multiplier up to `x4` and increments your `Close` run total.

```js
if (l.nearMiss) {
    nearMissCount++;
    combo = Math.min(4, combo + 1);
    const pts = 50 * combo;
    score += pts;
    syncHighScore();
    showBanner(`+${pts} CLOSE CALL x${combo}`, '#facc15', 1100);
    playTone(540 + combo * 60, 820 + combo * 60, 0.09);
    haptic(15);
}
```

### 6. Impact Sparks, Audio, Haptics & Run Summary
- **Impact Sparks & Screen Shake:** Crashes and pickups burst lightweight square particles (`particles` capped at `28`) alongside screen shake and flash feedback.
- **Web Audio SFX:** Pre-decodes MP3 sound effects (`crash.mp3`, `gameover.mp3`, `health.mp3`) into Web Audio buffers and plays crisp synth chimes via `playTone()`.
- **Mobile Haptics & Persistent Stats:** Fires optional `navigator.vibrate` pulses on mobile, saves your all-time `Best` score in `localStorage` (`brewBashHighScore`), and displays **Distance (`km`)**, **Top Speed (`km/h`)**, and **Close Calls** on the Game Over popup.

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
