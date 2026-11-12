const canvasFrame = document.getElementById('canvasFrame');
const canvas = document.getElementById('roadCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const CAR_BLINK_DURATION = 1500;
const CAR_BLINK_INTERVAL = 100;
const SPEED_CYCLE = [5.0, 4.5, 4.0, 4.5];

let carWidth = 44;
let carHeight = 96;
let brewWidth = 22;
let brewHeight = 33;
let brewRadius = 10;
let heartSize = 24;
let baseCarMoveSpeed = 400;
let baseObstacleSpeed = 200;

let roadWidth = 0;
let laneWidth = 75;
let centerX = 0;
let carBaseX = 0;
let maxOffset = 0;
let carY = 0;

let activeStart = 1; // 0 => lanes 1-2, 1 => lanes 2-3, 2 => lanes 3-4
let diversion = null;
let diversionCooldown = 5500;
let mergeBannerText = '';
let mergeBannerColor = '#22c55e';
let mergeBannerTimer = 0;

let carOffsetX = 0;
let worldScrollY = 0;
let score = 0;
let health = 100;
let gameOver = false;
let lampposts = [];
let gameSpeedMultiplier = 1;
let manualSpeedOffset = 0;
let lastHudSpeed = -1;
const keys = { left: false, right: false, up: false, down: false };
let healthDrop = null;
let heartCooldown = 8000;
let animationId = null;
let paused = true;
let countdownActive = false;
let countdownStartTime = 0;
let carBlinkRemaining = 0;
let lastTimestamp = 0;

const nameOverlay = document.getElementById('nameInputOverlay');
const finalScoreSpan = document.getElementById('finalScore');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const startScreenOverlay = document.getElementById('startScreenOverlay');
const hudScore = document.getElementById('hudScore');
const hudSpeed = document.getElementById('hudSpeed');
const hudLanes = document.getElementById('hudLanes');
const speedBarFill = document.getElementById('speedBarFill');
const healthBarFill = document.getElementById('healthBarFill');
const moveLeftBtn = document.getElementById('moveLeftBtn');
const moveRightBtn = document.getElementById('moveRightBtn');

let carImageLoaded = false;
let beerImageLoaded = false;
let heartImageLoaded = false;
let carSprite = null;
let beerSprite = null;
let heartSprite = null;

function bakeSprite(img, w, h) {
    if (!img.complete || img.naturalWidth === 0 || w <= 0 || h <= 0) return null;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    off.getContext('2d').drawImage(img, 0, 0, w, h);
    return off;
}

function bakeAllSprites() {
    carSprite = bakeSprite(carImage, carWidth, carHeight);
    beerSprite = bakeSprite(beerImage, brewWidth, brewHeight);
    heartSprite = bakeSprite(heartImage, heartSize, heartSize);
}

function loadSprite(src, onLoad) {
    const img = new Image();
    img.onload = () => {
        onLoad(true);
        bakeAllSprites();
        if (paused || countdownActive || gameOver) drawScene();
    };
    img.onerror = () => {
        console.error(`Failed to load ${src}, using fallback.`);
        onLoad(false);
    };
    img.src = src;
    return img;
}

const carImage = loadSprite('assets/images/car.png', loaded => { carImageLoaded = loaded; });
const beerImage = loadSprite('assets/images/beer.png', loaded => { beerImageLoaded = loaded; });
const heartImage = loadSprite('assets/images/heart.png', loaded => { heartImageLoaded = loaded; });

function loadSound(src) {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.onerror = () => console.error(`Failed to load ${src}.`);
    return audio;
}

const crashSound = loadSound('assets/audio/crash.mp3');
const gameOverSound = loadSound('assets/audio/gameover.mp3');
const collectSound = loadSound('assets/audio/health.mp3');

function playSound(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function clearKeys() {
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
}

function activeCenterBounds(laneStart, margin) {
    const left = carBaseX + laneStart * laneWidth + margin;
    const right = carBaseX + (laneStart + 2) * laneWidth - margin;
    return [left, Math.max(left, right)];
}

function clampInZone(x, laneStart, margin) {
    const [left, right] = activeCenterBounds(laneStart, margin);
    return Math.max(left, Math.min(right, x));
}

function resizeCanvas() {
    const prevMax = maxOffset;
    const ratio = prevMax > 0 ? carOffsetX / prevMax : 0.5;
    canvas.width = canvasFrame.clientWidth || 300;
    canvas.height = canvasFrame.clientHeight || 400;

    roadWidth = canvas.width * 0.92;
    laneWidth = roadWidth / 4;
    centerX = canvas.width / 2;
    carBaseX = centerX - roadWidth / 2;

    const scale = Math.max(0.85, Math.min(1.55, Math.min(canvas.width / 460, canvas.height / 540)));
    carWidth = Math.min(Math.round(44 * scale), Math.max(26, Math.floor(laneWidth * 0.62)));
    carHeight = Math.round(carWidth * 2.15);
    brewWidth = Math.min(Math.round(22 * scale), Math.max(16, Math.floor(laneWidth * 0.34)));
    brewHeight = Math.round(brewWidth * 1.5);
    brewRadius = brewWidth * 0.45;
    heartSize = Math.min(Math.round(24 * scale), Math.max(18, Math.floor(laneWidth * 0.36)));

    maxOffset = Math.max(0, roadWidth - carWidth);
    carY = canvas.height - carHeight - Math.round(18 * scale);
    carOffsetX = Math.max(
        activeStart * laneWidth + 4,
        Math.min((activeStart + 2) * laneWidth - carWidth - 4, ratio * maxOffset)
    );

    baseCarMoveSpeed = Math.max(240, laneWidth * 2.4);
    baseObstacleSpeed = Math.max(190, Math.min(270, canvas.height * 0.35));

    if (diversion) {
        diversion.signLead = Math.max(220, canvas.height * 0.42);
        diversion.taperH = Math.max(68, Math.min(120, laneWidth * 0.85));
        diversion.totalDist = carY + diversion.signLead;
    }

    bakeAllSprites();
    for (const l of lampposts) {
        const zone = (diversion && l.y <= diversion.y) ? diversion.newStart : activeStart;
        l.x = clampInZone(l.x, zone, brewWidth * 0.65);
    }
    if (healthDrop && healthDrop.active) {
        const zone = (diversion && healthDrop.y <= diversion.y) ? diversion.newStart : activeStart;
        healthDrop.x = clampInZone(healthDrop.x, zone, heartSize * 0.6);
    }
}

function startCountdown() {
    if (!gameOver && paused && !countdownActive) {
        countdownActive = true;
        countdownStartTime = 0;
        updateButtonStates();
        animationId = requestAnimationFrame(countdownAnimation);
    }
}

function returnToStartScreen() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    resetGame();
    paused = true;
    startScreenOverlay.style.display = 'flex';
    updateButtonStates();
    drawScene();
}

function togglePause() {
    if (gameOver || countdownActive) return;
    if (startScreenOverlay.style.display !== 'none') {
        handleStartScreenClick();
    } else if (paused) {
        startCountdown();
    } else {
        paused = true;
        clearKeys();
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        updateButtonStates();
    }
}

playBtn.addEventListener('click', startCountdown);
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', returnToStartScreen);
closeOverlayBtn.addEventListener('click', returnToStartScreen);

document.addEventListener('keydown', e => {
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!typing) {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') { e.preventDefault(); keys.up = true; }
        if (e.code === 'KeyS' || e.code === 'ArrowDown') { e.preventDefault(); keys.down = true; }
        if (e.code === 'Space') {
            e.preventDefault();
            togglePause();
        }
    }
});

document.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
});

window.addEventListener('blur', clearKeys);

function bindMoveButton(btn, dir) {
    const start = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        if (!gameOver && !paused && !countdownActive) keys[dir] = true;
    };
    const stop = (e) => {
        if (e.type.startsWith('touch')) e.preventDefault();
        keys[dir] = false;
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop, { passive: false });
    btn.addEventListener('touchcancel', stop, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
}

bindMoveButton(moveLeftBtn, 'left');
bindMoveButton(moveRightBtn, 'right');

function showGameOverOverlay() {
    clearKeys();
    finalScoreSpan.textContent = score;
    nameOverlay.style.display = 'flex';
    updateButtonStates();
}

function updateButtonStates() {
    playBtn.disabled = !paused || gameOver || countdownActive;
    pauseBtn.disabled = paused || gameOver || countdownActive;
    restartBtn.disabled = false;
    moveLeftBtn.disabled = paused || gameOver || countdownActive;
    moveRightBtn.disabled = paused || gameOver || countdownActive;
}

function triggerCrash(damage = 25) {
    health = Math.max(0, health - damage);
    if (health <= 0) {
        gameOver = true;
        paused = true;
        crashSound.pause();
        crashSound.currentTime = 0;
        playSound(gameOverSound);
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        updateHUDDisplay();
        showGameOverOverlay();
        return true;
    }
    playSound(crashSound);
    carBlinkRemaining = CAR_BLINK_DURATION;
    updateHUDDisplay();
    return false;
}

function randomZoneX(laneStart, margin) {
    const [left, right] = activeCenterBounds(laneStart, margin);
    return left + Math.random() * Math.max(0, right - left);
}

function spawnBrewWave(baseY) {
    if (diversion && Math.abs(baseY - diversion.y) < diversion.taperH + brewHeight * 2) {
        return;
    }
    const zoneStart = (diversion && baseY <= diversion.y) ? diversion.newStart : activeStart;
    const multiChance = Math.min(0.4, 0.14 + (gameSpeedMultiplier - 1) * 0.06);
    const count = Math.random() < multiChance ? 2 : 1;

    const minGap = carWidth * 1.85;
    const placed = [];
    for (let n = 0; n < count; n++) {
        let x = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            const candidate = randomZoneX(zoneStart, brewWidth * 0.7);
            if (placed.every(px => Math.abs(px - candidate) >= minGap)) {
                x = candidate;
                break;
            }
        }
        if (x === null) continue;
        placed.push(x);
        const drift = Math.random() < 0.2 ? (Math.random() - 0.5) * laneWidth * 0.25 : 0;
        lampposts.push({
            x,
            y: baseY + (Math.random() - 0.5) * brewHeight * 0.4,
            vx: drift,
            speedFactor: 0.95 + Math.random() * 0.12,
            checked: false
        });
    }
}

function rectCircleColliding(cx, cy, r, rx, ry, rw, rh) {
    const dx = Math.abs(cx - rx - rw / 2);
    const dy = Math.abs(cy - ry - rh / 2);
    if (dx > rw / 2 + r || dy > rh / 2 + r) return false;
    if (dx <= rw / 2 || dy <= rh / 2) return true;
    const dx2 = dx - rw / 2;
    const dy2 = dy - rh / 2;
    return dx2 * dx2 + dy2 * dy2 <= r * r;
}

function updateSpeedControl(deltaTime) {
    const dt = deltaTime / 1000;
    if (keys.up) {
        manualSpeedOffset = Math.min(0.8, manualSpeedOffset + 1.8 * dt);
    } else if (keys.down) {
        manualSpeedOffset = Math.max(-0.5, manualSpeedOffset - 2.2 * dt);
    } else if (manualSpeedOffset !== 0) {
        const step = 1.6 * dt;
        manualSpeedOffset = Math.abs(manualSpeedOffset) <= step ? 0 : manualSpeedOffset - Math.sign(manualSpeedOffset) * step;
    }
    const nextSpeed = Math.max(0.6, Math.min(5.5, getSpeedForScore(score) + manualSpeedOffset));
    const rounded = Math.round(nextSpeed * 100);
    gameSpeedMultiplier = nextSpeed;
    if (rounded !== lastHudSpeed) {
        updateHUDDisplay();
    }
}

function updateDiversion(deltaTime) {
    if (mergeBannerTimer > 0) mergeBannerTimer = Math.max(0, mergeBannerTimer - deltaTime);

    if (!diversion) {
        diversionCooldown -= deltaTime;
        if (diversionCooldown <= 0) {
            const dir = activeStart === 0 ? 1 : (activeStart === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1));
            const signLead = Math.max(220, canvas.height * 0.42);
            const taperH = Math.max(68, Math.min(120, laneWidth * 0.85));
            diversion = {
                oldStart: activeStart,
                newStart: activeStart + dir,
                dir,
                y: -signLead - 40,
                signLead,
                taperH,
                totalDist: carY + signLead,
                resolved: false
            };
        }
        return;
    }

    diversion.y += (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime;

    if (!diversion.resolved && diversion.y + diversion.taperH * 0.55 >= carY) {
        diversion.resolved = true;
        const carCenterX = carBaseX + carOffsetX + carWidth / 2;
        const [newLeft, newRight] = activeCenterBounds(diversion.newStart, 0);

        if (carCenterX < newLeft || carCenterX > newRight) {
            mergeBannerText = 'BARRICADE HIT! -25 HP';
            mergeBannerColor = '#ef4444';
            mergeBannerTimer = 1500;
            if (triggerCrash(25)) return;
        } else {
            score += 100;
            mergeBannerText = '+100 SAFE MERGE!';
            mergeBannerColor = '#22c55e';
            mergeBannerTimer = 1500;
        }

        activeStart = diversion.newStart;
        const minCar = activeStart * laneWidth + 4;
        const maxCar = (activeStart + 2) * laneWidth - carWidth - 4;
        carOffsetX = Math.max(minCar, Math.min(maxCar, carOffsetX));
        updateHUDDisplay();
    }

    if (diversion.y > canvas.height + diversion.taperH + 40) {
        diversion = null;
        diversionCooldown = 8000 + Math.random() * 6000;
    }
}

function updateLampposts(deltaTime) {
    if (!gameOver && lampposts.length < 10) {
        if (lampposts.length === 0) {
            spawnBrewWave(-brewHeight);
        } else {
            let topY = Infinity;
            for (const l of lampposts) {
                if (l.y < topY) topY = l.y;
            }
            if (topY >= 0) {
                const spacing = Math.max(220, canvas.height * (0.38 + Math.random() * 0.28));
                spawnBrewWave(topY - spacing);
            }
        }
    }

    const carX = carBaseX + carOffsetX;
    const baseStep = (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime;

    for (let i = lampposts.length - 1; i >= 0; i--) {
        const l = lampposts[i];
        l.y += baseStep * l.speedFactor;
        if (l.vx) {
            const zoneStart = (diversion && l.y <= diversion.y) ? diversion.newStart : activeStart;
            const [zLeft, zRight] = activeCenterBounds(zoneStart, brewWidth * 0.65);
            l.x += (l.vx / 1000) * deltaTime;
            if (l.x <= zLeft) { l.x = zLeft; l.vx = Math.abs(l.vx); }
            else if (l.x >= zRight) { l.x = zRight; l.vx = -Math.abs(l.vx); }
        }

        if (!l.checked && carBlinkRemaining <= 0 && rectCircleColliding(l.x, l.y, brewRadius, carX, carY, carWidth, carHeight)) {
            l.checked = true;
            if (triggerCrash(25)) return;
        }

        if (l.y > canvas.height + brewHeight) {
            lampposts.splice(i, 1);
            if (!l.checked && !gameOver) {
                score += 50;
                updateHUDDisplay();
            }
        }
    }
}

function updateHealthDrop(deltaTime) {
    if (!gameOver && (!healthDrop || !healthDrop.active)) {
        heartCooldown -= deltaTime;
        if (heartCooldown <= 0) {
            if (health < 100) {
                const zoneStart = (diversion && -heartSize <= diversion.y) ? diversion.newStart : activeStart;
                healthDrop = {
                    x: randomZoneX(zoneStart, heartSize * 0.6),
                    y: -heartSize,
                    speedFactor: 0.85 + Math.random() * 0.25,
                    swayPhase: Math.random() * Math.PI * 2,
                    swayAmp: Math.random() * 20 + 12,
                    active: true
                };
                heartCooldown = (health <= 25 ? 4500 : 8000) + Math.random() * 6000;
            } else {
                heartCooldown = 2000 + Math.random() * 2000;
            }
        }
    }

    if (!healthDrop || !healthDrop.active) return;

    const step = (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime * healthDrop.speedFactor;
    healthDrop.y += step;
    healthDrop.swayPhase += deltaTime * 0.004;
    const zoneStart = (diversion && healthDrop.y <= diversion.y) ? diversion.newStart : activeStart;
    healthDrop.x = clampInZone(healthDrop.x + Math.sin(healthDrop.swayPhase) * healthDrop.swayAmp * (deltaTime / 1000), zoneStart, heartSize * 0.6);

    const halfHeart = heartSize / 2;
    const carX = carBaseX + carOffsetX;
    if (
        healthDrop.y + halfHeart >= carY &&
        healthDrop.y - halfHeart <= carY + carHeight &&
        healthDrop.x + halfHeart >= carX &&
        healthDrop.x - halfHeart <= carX + carWidth
    ) {
        health = Math.min(health + 25, 100);
        healthDrop.active = false;
        playSound(collectSound);
        updateHUDDisplay();
    } else if (healthDrop.y > canvas.height + heartSize) {
        healthDrop.active = false;
    }
}

function getSpeedForScore(currentScore) {
    if (currentScore < 8000) {
        return 1.0 + Math.floor(currentScore / 500) * 0.25;
    }
    const step = Math.floor((currentScore - 8000) / 500);
    return SPEED_CYCLE[step % SPEED_CYCLE.length];
}

function drawBarricadeBox(bx, by, bw, bh) {
    ctx.fillStyle = '#f97316';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#f8fafc';
    const seg = Math.max(8, bw / 5);
    for (let sx = 0; sx < bw - seg * 0.5; sx += seg * 2) {
        ctx.fillRect(bx + sx, by, Math.min(seg, bw - sx), bh);
    }
    ctx.fillStyle = '#475569';
    ctx.fillRect(bx + 2, by + bh, 3, 5);
    ctx.fillRect(bx + bw - 5, by + bh, 3, 5);
}

function drawDivider(dx, scrollY) {
    const w = 7;
    const x = dx - w / 2;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(x, 0, w, canvas.height);
    ctx.fillStyle = '#f8fafc';
    for (let y = (scrollY % 40) - 40; y < canvas.height; y += 40) {
        ctx.fillRect(x, y, w, 20);
    }
}

function drawRoadSection(laneStart, scrollY) {
    ctx.fillStyle = '#0f291e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#131822';
    ctx.fillRect(carBaseX, 0, roadWidth, canvas.height);

    // Active 2-lane corridor
    ctx.fillStyle = '#222a38';
    ctx.fillRect(carBaseX + laneStart * laneWidth, 0, laneWidth * 2, canvas.height);

    // Outer road curbs
    const curbW = 5;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(carBaseX - curbW / 2, 0, curbW, canvas.height);
    ctx.fillRect(carBaseX + roadWidth - curbW / 2, 0, curbW, canvas.height);
    ctx.fillStyle = '#ef4444';
    for (let y = (scrollY % 40) - 40; y < canvas.height; y += 40) {
        ctx.fillRect(carBaseX - curbW / 2, y, curbW, 20);
        ctx.fillRect(carBaseX + roadWidth - curbW / 2, y, curbW, 20);
    }

    // Closed lanes: faint divider lines, red X markers, and scrolling barricades
    for (let lane = 0; lane < 4; lane++) {
        if (lane === laneStart || lane === laneStart + 1) continue;
        const lx = carBaseX + lane * laneWidth;
        const cx = lx + laneWidth / 2;
        const barW = Math.min(laneWidth * 0.64, 68);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
        for (let y = (scrollY % 90) - 90; y < canvas.height; y += 90) {
            ctx.fillRect(lx + 8, y, laneWidth - 16, 8);
        }

        for (let y = (scrollY % 180) - 180; y < canvas.height; y += 180) {
            drawBarricadeBox(cx - barW / 2, y + 36, barW, 10);
        }
    }

    // Active center lane dashed divider
    const activeMidX = Math.round(carBaseX + (laneStart + 1) * laneWidth) - 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let y = (scrollY % 60) - 60; y < canvas.height; y += 60) {
        ctx.fillRect(activeMidX, y, 2, 30);
    }

    // Highway dividers separating active lanes from closed lanes
    if (laneStart > 0) drawDivider(carBaseX + laneStart * laneWidth, scrollY);
    if (laneStart + 2 < 4) drawDivider(carBaseX + (laneStart + 2) * laneWidth, scrollY);
}

function drawSignBoard(d, meters) {
    const signY = d.y + d.signLead;
    if (signY < -80 || signY > canvas.height + 80) return;

    const signW = Math.min(roadWidth * 0.92, 380);
    const signH = 56;
    const sx = centerX - signW / 2;
    const sy = signY - signH / 2;

    // Gantry beam
    ctx.fillStyle = '#475569';
    ctx.fillRect(carBaseX, signY - 3, roadWidth, 6);

    // Highway green/amber sign plate
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(sx, sy, signW, signH);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, signW, signH);

    const dirText = d.dir > 0 ? 'TAKE RIGHT \u2192' : '\u2190 TAKE LEFT';
    const fontPx = Math.max(9, Math.min(13, Math.floor(signW / 28)));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontPx}px "Press Start 2P", cursive`;
    ctx.fillStyle = '#facc15';
    ctx.fillText(`${meters}m ROAD CLOSED`, sx + 12, sy + 18);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(dirText, sx + 12, sy + 39);

    // Mini 4-lane diagram on the right side of the sign
    const boxW = 14;
    const boxGap = 3;
    const miniX = sx + signW - (boxW * 4 + boxGap * 3 + 12);
    const miniY = sy + 16;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    for (let lane = 0; lane < 4; lane++) {
        const open = lane === d.newStart || lane === d.newStart + 1;
        const bx = miniX + lane * (boxW + boxGap);
        ctx.fillStyle = open ? '#16a34a' : '#dc2626';
        ctx.fillRect(bx, miniY, boxW, 24);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(open ? '\u2191' : '\u2715', bx + boxW / 2, miniY + 13);
    }
}

function drawDiversionCut(d) {
    const cutY = d.y;
    const tH = d.taperH;
    if (cutY + tH < -20 || cutY > canvas.height + 20) return;

    const closingLane = d.dir > 0 ? d.oldStart : d.oldStart + 1;
    const xBottom = d.dir > 0 ? carBaseX + closingLane * laneWidth : carBaseX + (closingLane + 1) * laneWidth;
    const xTop = d.dir > 0 ? carBaseX + (closingLane + 1) * laneWidth : carBaseX + closingLane * laneWidth;

    // Diagonal taper beam & cones
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(xBottom, cutY + tH);
    ctx.lineTo(xTop, cutY);
    ctx.stroke();

    const blink = Math.floor(worldScrollY / 20) % 2 === 0;
    for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const cx = xBottom + (xTop - xBottom) * t;
        const cy = cutY + tH * (1 - t);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = blink ? '#facc15' : '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Prominent barricade across the closing lane
    const barW = laneWidth * 0.78;
    const barX = carBaseX + closingLane * laneWidth + (laneWidth - barW) / 2;
    drawBarricadeBox(barX, cutY + tH * 0.45, barW, 13);
}

function drawRoad() {
    if (!diversion) {
        drawRoadSection(activeStart, worldScrollY);
        return;
    }

    const cutY = Math.max(0, Math.min(canvas.height, diversion.y));
    if (cutY > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, cutY);
        ctx.clip();
        drawRoadSection(diversion.newStart, worldScrollY);
        ctx.restore();
    }
    if (cutY < canvas.height) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, cutY, canvas.width, canvas.height - cutY);
        ctx.clip();
        drawRoadSection(diversion.oldStart, worldScrollY);
        ctx.restore();
    }

    drawDiversionCut(diversion);
    const meters = Math.max(0, Math.min(100, Math.round(((carY - diversion.y) / diversion.totalDist) * 100)));
    drawSignBoard(diversion, meters);

    // Sticky top warning badge while approaching the cut
    if (!diversion.resolved && diversion.y + diversion.signLead > 0) {
        const msg = `${meters}m \u2022 ${diversion.dir > 0 ? 'TAKE RIGHT \u2192' : '\u2190 TAKE LEFT'}`;
        const pillW = Math.min(canvas.width - 24, 300);
        const px = centerX - pillW / 2;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(px, 10, pillW, 28);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, 10, pillW, 28);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 10px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(msg, centerX, 24);
    }
}

function drawLampposts() {
    for (const l of lampposts) {
        if (beerSprite) {
            ctx.drawImage(beerSprite, l.x - brewWidth / 2, l.y - brewHeight / 2);
        } else if (beerImageLoaded) {
            ctx.drawImage(beerImage, l.x - brewWidth / 2, l.y - brewHeight / 2, brewWidth, brewHeight);
        } else {
            ctx.beginPath();
            ctx.arc(l.x, l.y, brewRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
        }
    }
}

function drawHealthDrop() {
    if (!healthDrop || !healthDrop.active) return;
    if (heartSprite) {
        ctx.drawImage(heartSprite, healthDrop.x - heartSize / 2, healthDrop.y - heartSize / 2);
    } else if (heartImageLoaded) {
        ctx.drawImage(heartImage, healthDrop.x - heartSize / 2, healthDrop.y - heartSize / 2, heartSize, heartSize);
    } else {
        ctx.font = `${heartSize}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('❤️', healthDrop.x, healthDrop.y);
    }
}

function drawCar() {
    if (carBlinkRemaining > 0 && Math.floor(carBlinkRemaining / CAR_BLINK_INTERVAL) % 2 === 1) {
        return;
    }
    const x = carBaseX + carOffsetX;
    if (carSprite) {
        ctx.drawImage(carSprite, x, carY);
    } else if (carImageLoaded) {
        ctx.drawImage(carImage, x, carY, carWidth, carHeight);
    } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, carY, carWidth, carHeight);
    }
}

function drawMergeBanner() {
    if (mergeBannerTimer <= 0 || !mergeBannerText) return;
    ctx.fillStyle = mergeBannerColor;
    ctx.font = 'bold 12px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mergeBannerText, centerX, 54);
}

function drawScene() {
    drawRoad();
    drawLampposts();
    drawHealthDrop();
    drawCar();
    drawMergeBanner();
}

function updateHUDDisplay() {
    hudScore.textContent = score;
    const speedKmh = Math.round(gameSpeedMultiplier * 100);
    lastHudSpeed = speedKmh;
    hudSpeed.textContent = `${speedKmh} km/h`;
    hudLanes.textContent = `${activeStart + 1} - ${activeStart + 2}`;

    const pacePct = Math.min(100, (gameSpeedMultiplier / 5.5) * 100);
    speedBarFill.style.width = `${pacePct}%`;
    let speedBarColor = '#38bdf8';
    if (gameSpeedMultiplier >= 4.5) speedBarColor = '#ef4444';
    else if (gameSpeedMultiplier >= 3.0) speedBarColor = '#f97316';
    else if (gameSpeedMultiplier >= 2.0) speedBarColor = '#facc15';
    speedBarFill.style.backgroundColor = speedBarColor;

    healthBarFill.style.width = `${health}%`;
    let healthBarColor = 'limegreen';
    if (health <= 25) healthBarColor = 'red';
    else if (health <= 50) healthBarColor = 'orange';
    healthBarFill.style.backgroundColor = healthBarColor;
}

function updateCar(deltaTime) {
    const movementAmount = (baseCarMoveSpeed / 1000) * deltaTime;
    if (keys.left) carOffsetX -= movementAmount;
    if (keys.right) carOffsetX += movementAmount;

    const minX = activeStart * laneWidth + 4;
    const maxX = (activeStart + 2) * laneWidth - carWidth - 4;
    carOffsetX = Math.max(minX, Math.min(maxX, carOffsetX));
}

function resetGame() {
    score = 0;
    health = 100;
    gameOver = false;
    countdownActive = false;
    countdownStartTime = 0;
    activeStart = 1;
    diversion = null;
    diversionCooldown = 5500;
    mergeBannerText = '';
    mergeBannerTimer = 0;
    lampposts = [];
    manualSpeedOffset = 0;
    gameSpeedMultiplier = getSpeedForScore(0);
    carOffsetX = activeStart * laneWidth + laneWidth - carWidth / 2;
    worldScrollY = 0;
    healthDrop = null;
    heartCooldown = 6000 + Math.random() * 6000;
    carBlinkRemaining = 0;
    clearKeys();

    for (const sound of [crashSound, gameOverSound, collectSound]) {
        sound.pause();
        sound.currentTime = 0;
    }

    nameOverlay.style.display = 'none';
    updateButtonStates();
    updateHUDDisplay();
}

function drawCountdown(number) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fontSize = Math.min(100, Math.floor(canvas.width * 0.28));
    ctx.font = `bold ${fontSize}px "Press Start 2P", cursive`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, canvas.width / 2, canvas.height / 2);
}

function countdownAnimation(timestamp) {
    if (!countdownActive) return;
    if (countdownStartTime === 0) countdownStartTime = timestamp;

    const remainingTime = 3000 - (timestamp - countdownStartTime);
    drawScene();

    if (remainingTime > 2000) {
        drawCountdown(3);
    } else if (remainingTime > 1000) {
        drawCountdown(2);
    } else if (remainingTime > 0) {
        drawCountdown(1);
    } else {
        countdownActive = false;
        paused = false;
        updateButtonStates();
        lastTimestamp = timestamp;
        animate(timestamp);
        return;
    }
    animationId = requestAnimationFrame(countdownAnimation);
}

function handleStartScreenClick() {
    startScreenOverlay.style.display = 'none';
    startCountdown();
}

window.addEventListener('resize', () => {
    resizeCanvas();
    if (paused || countdownActive || gameOver) drawScene();
});

window.onload = () => {
    resizeCanvas();
    resetGame();
    startScreenOverlay.style.display = 'flex';
    startScreenOverlay.addEventListener('click', handleStartScreenClick);
    paused = true;
    updateButtonStates();
    drawScene();
};

function animate(timestamp) {
    if (lastTimestamp === 0) lastTimestamp = timestamp;
    if (paused || gameOver || countdownActive) return;

    const MAX_DELTA_TIME = 100;
    const deltaTime = Math.min(timestamp - lastTimestamp, MAX_DELTA_TIME);
    lastTimestamp = timestamp;

    if (carBlinkRemaining > 0) {
        carBlinkRemaining = Math.max(0, carBlinkRemaining - deltaTime);
    }

    updateSpeedControl(deltaTime);
    updateCar(deltaTime);
    updateDiversion(deltaTime);
    if (gameOver) {
        drawScene();
        return;
    }
    updateLampposts(deltaTime);
    updateHealthDrop(deltaTime);

    if (gameOver) {
        drawScene();
        return;
    }

    worldScrollY = (worldScrollY + (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime) % 360;

    drawScene();

    animationId = requestAnimationFrame(animate);
}
