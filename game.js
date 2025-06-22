const canvas = document.getElementById('roadCanvas');
const ctx = canvas.getContext('2d');

// Game Settings
const roadWidth = 300;
const centerX = canvas.width / 2;
const carWidth = 50;
const carHeight = 110;
const carY = canvas.height - carHeight - 140;
const carBaseX = centerX - roadWidth / 2 + 20;
const maxOffset = roadWidth - carWidth - 40;

// Base speeds are now defined in pixels per second.
// These values have been increased to compensate for delta time normalization,
// aiming for the perceived speed you had on your higher refresh rate system.
const baseCarMoveSpeed = 400; // Pixels per second for car side-to-side movement (increased for responsiveness)
const baseObstacleSpeed = 200; // Base vertical speed for obstacles and health drops in pixels per second

const HIGH_SCORE_KEY = 'drunk_dodge_highscores';
const MAX_SCORES = 10;
const SCORE_RESET_TIME_KEY = 'drunk_dodge_score_reset_time';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Game State
let carOffsetX = 0;
let dashOffset = 0;
let score = 0;
let health = 100;
let gameOver = false;
let lampposts = [];
let gameSpeedMultiplier = 1; // This will be set by getSpeedForScore, scales baseObstacleSpeed
let lastLamppostY = -200;
const keys = { left: false, right: false };
let healthDrop = null; // { x, y, active }
let animationId = null;
let paused = true; // Start paused

// Flag to track if the specific 25% health drop has been given in the current game
let healthDrop25PercentGiven = false;

// --- New Blink Effect Variables ---
let carBlinkActive = false;
let carBlinkStartTime = 0;
const CAR_BLINK_DURATION = 1500; // Car blinks for 1.5 seconds after a hit
const CAR_BLINK_INTERVAL = 100; // Car visibility toggles every 100ms
// --- End New Blink Effect Variables ---

// The blind effect was the full screen overlay. Let's keep it here if you intended it as a separate effect,
// but the new "car blink" replaces the "blind effect on crash" activation.
let blindEffectActive = false; // Still declare if you use elsewhere, but no longer tied to crash here.
let blindEffectStartTime = 0;
const BLIND_EFFECT_DURATION = 2000; // 2 seconds in milliseconds


// DOM Elements
const nameOverlay = document.getElementById('nameInputOverlay');
const finalScoreSpan = document.getElementById('finalScore');
const nameInput = document.getElementById('nameInput');
const submitBtn = document.getElementById('submitName');
const highScoresList = document.getElementById('highScoresList');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

// New HUD DOM elements (references to elements in controlPanel)
const hudScore = document.getElementById('hudScore');
const hudSpeed = document.getElementById('hudSpeed');
const speedBarFill = document.getElementById('speedBarFill');
const hudHealthValue = document.getElementById('hudHealthValue');
const healthBarFill = document.getElementById('healthBarFill');

// --- New DOM element for the reset timer ---
const resetTimerDisplay = document.getElementById('resetTimer');

// Game Assets - Ensure these image paths are correct relative to your HTML file
let carImageLoaded = false;
let beerImageLoaded = false;
let heartImageLoaded = false; // For health drops

const carImage = new Image();
carImage.src = 'car.png';
carImage.onload = () => carImageLoaded = true;

const beerImage = new Image();
beerImage.src = 'beer.png';
beerImage.onload = () => beerImageLoaded = true;

const heartImage = new Image();
heartImage.src = 'heart.png';
heartImage.onload = () => heartImageLoaded = true;

// Sounds - Ensure these audio paths are correct relative to your HTML file
const crashSound = new Audio('crash.mp3');
crashSound.volume = 0.5;

const gameOverSound = new Audio('gameover.mp3');
gameOverSound.volume = 0.5;

const collectSound = new Audio('collect.mp3');
collectSound.volume = 0.5;

// --- Event Listeners ---

// Touch controls for mobile
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchmove', handleTouchMove);

// Play button handler
playBtn.addEventListener('click', () => {
    // If the game is over, cannot play, must restart
    if (gameOver) return;
    // If game is paused, unpause and start animation
    if (paused) {
        paused = false;
        animate(performance.now()); // Pass initial timestamp to start animation loop
        updateButtonStates(); // Update button enable/disable states
    }
});

// Pause button handler
pauseBtn.addEventListener('click', () => {
    // Only pause if game is not over and not already paused
    if (!gameOver && !paused) {
        paused = true;
        // Stop the animation frame loop
        if (animationId) cancelAnimationFrame(animationId);
        updateButtonStates(); // Update button enable/disable states
    }
});

// Restart button handler
restartBtn.addEventListener('click', () => {
    resetGame(); // Reset all game state variables
    paused = false; // Game starts unpaused after restart
    // Stop any existing animation loop before starting a new one
    if (animationId) cancelAnimationFrame(animationId);
    animate(performance.now()); // Start a new game loop, pass initial timestamp
    updateButtonStates(); // Update button enable/disable states
});

// Keyboard input for car movement and game over prompt
document.addEventListener('keydown', e => {
    // Prevent key presses from affecting input field
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!typing) {
        // If game is over, allow 'R' key to prompt for name if not already visible
        if (gameOver && e.code === 'KeyR') {
            if (nameOverlay.style.display !== 'flex') promptForName();
        }
        // Set key state to true for left/right movement
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    }
});

// Keyboard key release to stop car movement
document.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});

// Submit name button handler after game over
submitBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Anonymous'; // Use 'Anonymous' if no name entered
    addHighScore(name, score); // Add current score to high scores
    nameOverlay.style.display = 'none'; // Hide the name input overlay
    resetGame(); // Reset game state
    paused = true; // Keep game paused after high score submission until user presses play again
    updateButtonStates(); // Update button enable/disable states
    // Stop animation after submit, as game is now paused
    if (animationId) cancelAnimationFrame(animationId);
});

// --- Game Functions ---

// Shows the game over overlay and prompts for player's name
function promptForName() {
    finalScoreSpan.textContent = score; // Display final score
    nameInput.value = ''; // Clear previous input
    nameOverlay.style.display = 'flex'; // Show the overlay
    nameInput.focus(); // Focus on the input field
    updateButtonStates(); // Update button states based on game over state
}

// Updates the disabled state of Play/Pause/Restart buttons
function updateButtonStates() {
    playBtn.disabled = !paused || gameOver; // Play button disabled if not paused or game over
    pauseBtn.disabled = paused || gameOver; // Pause button disabled if paused or game over
    restartBtn.disabled = false; // Restart button is always enabled
}

// High Score Functions
function getHighScores() {
    const now = Date.now();
    const lastReset = parseInt(localStorage.getItem(SCORE_RESET_TIME_KEY), 10) || 0;

    // Reset scores if a week has passed since the last reset
    if (now - lastReset > ONE_WEEK_MS) {
        localStorage.setItem(SCORE_RESET_TIME_KEY, now.toString());
        localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify([]));
        return [];
    }
    // Retrieve and parse existing high scores
    return JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) || '[]');
}

function setHighScores(scores) {
    // Save scores to local storage
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores));
    // Set reset time if it's not already set
    if (!localStorage.getItem(SCORE_RESET_TIME_KEY)) {
        localStorage.setItem(SCORE_RESET_TIME_KEY, Date.now().toString());
    }
}

function addHighScore(name, score) {
    const scores = getHighScores();
    scores.push({ name, score }); // Add new score
    scores.sort((a, b) => b.score - a.score); // Sort in descending order
    // Keep only the top MAX_SCORES
    if (scores.length > MAX_SCORES) scores.length = MAX_SCORES;
    setHighScores(scores); // Save updated scores
    displayHighScores(); // Update displayed high scores
    updateResetTimerDisplay(); // Update timer display as a new score might have set the reset time
}

// Renders the high scores list on the scoreboard
function displayHighScores() {
    const scores = getHighScores();
    highScoresList.innerHTML = scores.map((e, i) => `<li>${i + 1}. ${e.name}: ${e.score}</li>`).join('');
}

// --- New Function: Updates the countdown timer for high score reset ---
function updateResetTimerDisplay() {
    const lastReset = parseInt(localStorage.getItem(SCORE_RESET_TIME_KEY), 10) || 0;
    const nextResetTime = lastReset + ONE_WEEK_MS;
    let timeRemaining = nextResetTime - Date.now();

    if (timeRemaining <= 0) {
        resetTimerDisplay.textContent = "Scores just reset!";
        // The getHighScores function already handles the actual reset on page load if overdue.
        // If you want a visual effect *right* when the timer hits zero without a reload,
        // you would trigger displayHighScores() here, but it's handled by getHighScores
        // when the user refreshes or starts a new session.
        return;
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    timeRemaining %= (1000 * 60 * 60 * 24);
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    timeRemaining %= (1000 * 60 * 60);
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    timeRemaining %= (1000 * 60);
    const seconds = Math.floor(timeRemaining / 1000);

    resetTimerDisplay.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}


// Game Logic
// Spawns a new lamppost (beer bottle) obstacle
function spawnLamppost() {
    const spacing = Math.random() * 150 + 200; // Random vertical spacing
    lastLamppostY -= spacing; // Move up for the new lamppost
    const x = carBaseX + Math.random() * (roadWidth - 40); // Random horizontal position within road
    lampposts.push({ x, y: lastLamppostY, checked: false }); // Add to lampposts array
}

// Checks for collision between a circle (lamppost/health drop) and a rectangle (car)
function rectCircleColliding(cx, cy, r, rx, ry, rw, rh) {
    const dx = Math.abs(cx - rx - rw / 2);
    const dy = Math.abs(cy - ry - rh / 2);
    if (dx > rw / 2 + r || dy > rh / 2 + r) return false;
    if (dx <= rw / 2 || dy <= rh / 2) return true;
    const dx2 = dx - rw / 2;
    const dy2 = dy - rh / 2;
    return dx2 * dx2 + dy2 * dy2 <= r * r;
}

// Updates positions of lampposts and handles collisions
function updateLampposts(deltaTime) {
    // Spawn new lamppost if needed (when current ones are far enough)
    if (!gameOver && (lampposts.length === 0 || canvas.height - lastLamppostY > 200)) {
        spawnLamppost();
    }

    const carX = carBaseX + carOffsetX;
    // Iterate through lampposts from back to front to handle splice correctly
    for (let i = lampposts.length - 1; i >= 0; i--) {
        const l = lampposts[i];
        // Move objects in pixels per second, converting deltaTime from ms to seconds
        l.y += (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime; // Scaled by gameSpeedMultiplier

        // Draw lamppost (beer bottle image or fallback circle)
        if (beerImageLoaded) {
            const imgWidth = 20;
            const imgHeight = 30;
            ctx.drawImage(beerImage, l.x - imgWidth / 2, l.y - imgHeight / 2, imgWidth, imgHeight);
        } else {
            ctx.beginPath();
            ctx.arc(l.x, l.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
        }

        // Collision detection for lampposts with the car
        // Only register a hit if car is NOT currently blinking (i.e., invulnerable)
        if (!l.checked && !carBlinkActive && rectCircleColliding(l.x, l.y, 10, carX, carY, carWidth, carHeight)) {
            l.checked = true; // Mark as checked to prevent multiple hits from one lamppost
            crashSound.currentTime = 0; // Rewind sound to play from start
            crashSound.play();
            health -= 25; // Decrease health

            // --- ACTIVATE CAR BLINK ON CRASH ---
            carBlinkActive = true;
            carBlinkStartTime = Date.now();
            // --- End ACTIVATE CAR BLINK ON CRASH ---

            updateHUDDisplay(); // Update HUD after health change

            if (health <= 0) {
                health = 0; // Ensure health doesn't go below zero
                gameOver = true; // Set game over state
                paused = true; // Pause the game
                crashSound.pause(); // Stop crash sound
                crashSound.currentTime = 0;
                gameOverSound.currentTime = 0; // Rewind game over sound
                gameOverSound.play(); // Play game over sound
                // Stop animation loop
                if (animationId) cancelAnimationFrame(animationId);
                promptForName(); // Prompt for name to save score
            }
        }

        // --- HEALTH DROP SPAWN LOGIC ---
        // Spawn health drop ONLY when health is 25% AND it hasn't been given yet in this game, AND no other health drop is active.
        if (health === 25 && !healthDrop25PercentGiven && (!healthDrop || !healthDrop.active)) {
            const dropX = carBaseX + Math.random() * maxOffset; // Random position within road
            healthDrop = { x: dropX, y: -50, active: true }; // Create health drop
            healthDrop25PercentGiven = true; // Set flag to true to prevent future spawns in this game
        }
        // --- END HEALTH DROP SPAWN LOGIC ---

        // Remove lamppost if it goes off-screen and update score if not hit
        if (l.y > canvas.height + 10) {
            lampposts.splice(i, 1); // Remove from array
            if (!l.checked && !gameOver) { // If not hit and game is not over
                score += 50; // Increase score
                gameSpeedMultiplier = getSpeedForScore(score); // Adjust speed based on score
                updateHUDDisplay(); // Update HUD after score/speed change
            }
        }
    }
}

// Updates position of health drop and handles collisions
function updateHealthDrop(deltaTime) {
    // Only proceed if a health drop exists and is active
    if (!healthDrop || !healthDrop.active) return;

    healthDrop.y += (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime; // Move health drop down with game speed

    // Draw health item (heart image or fallback emoji)
    // This is where the heart.png image is drawn if successfully loaded.
    if (heartImageLoaded) {
        const imgWidth = 20; // Control the width of the heart image here
        const imgHeight = 20; // Control the height of the heart image here
        ctx.drawImage(heartImage, healthDrop.x - imgWidth / 2, healthDrop.y - imgHeight / 2, imgWidth, imgHeight);
    } else {
        ctx.font = '24px serif'; // Fallback to emoji if image not loaded
        ctx.textAlign = 'center';
        ctx.fillText('💖', healthDrop.x, healthDrop.y);
    }

    // Collision detection with car
    const carX = carBaseX + carOffsetX;
    if (
        healthDrop.active &&
        // Check if health drop is within car's Y range
        healthDrop.y >= carY &&
        healthDrop.y <= carY + carHeight &&
        // Check if health drop is within car's X range
        healthDrop.x >= carX &&
        healthDrop.x <= carX + carWidth
    ) {
        const dropAmount = 25; // Fixed health restoration amount
        health = Math.min(health + dropAmount, 100); // Add health, capped at 100
        healthDrop.active = false; // Deactivate health drop after collection
        collectSound.currentTime = 0; // Rewind collect sound
        collectSound.play(); // Play collect sound
        updateHUDDisplay(); // Update HUD after health change
    }

    // Remove if health drop goes off screen without being collected
    if (healthDrop.y > canvas.height) {
        healthDrop.active = false;
    }
}

// Calculates game speed based on current score
function getSpeedForScore(score) {
    // These return values are now direct multipliers for the baseObstacleSpeed (pixels/second).
    // I've adjusted them to provide a reasonable progression of speed.
    // Feel free to fine-tune these values further for your desired game difficulty curve.

    if (score < 500) return 1.0; // Base speed multiplier
    if (score < 1000) return 1.2;
    if (score < 2000) return 1.4;
    if (score < 3000) return 1.6;
    if (score < 4000) return 1.8;
    if (score < 5000) return 2.0;
    if (score < 6000) return 2.2;
    if (score < 7000) return 2.4;
    if (score < 8000) return 2.6;
    if (score < 10000) return 2.8;
    // The previous score-based decrease (score < 8500) was problematic if not linear.
    // I'm simplifying this to a continuous increase. If you want decreases, structure them
    // more clearly (e.g., return a lower value for specific higher score thresholds).
    if (score < 12000) return 3.0;
    if (score < 14000) return 3.2;
    if (score < 16000) return 3.4;
    if (score < 18000) return 3.6;
    if (score < 20000) return 3.8;

    return 4.0; // Maximum speed multiplier
}

// --- Drawing Functions (Canvas) ---

// Draws the road, including lines and dashed center line
function drawRoad() {
    ctx.fillStyle = '#222'; // Road color
    ctx.fillRect(centerX - roadWidth / 2, 0, roadWidth, canvas.height); // Draw road rectangle

    ctx.strokeStyle = '#ccc'; // Road border color
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - roadWidth / 2, 0); // Left border
    ctx.lineTo(centerX - roadWidth / 2, canvas.height);
    ctx.moveTo(centerX + roadWidth / 2, 0); // Right border
    ctx.lineTo(centerX + roadWidth / 2, canvas.height);
    ctx.stroke();

    ctx.setLineDash([30, 30]); // Dashed line pattern
    ctx.strokeStyle = 'white'; // Dashed line color
    ctx.lineWidth = 2;
    ctx.lineDashOffset = -dashOffset; // Animate dash offset for moving effect
    ctx.beginPath();
    ctx.moveTo(centerX, 0); // Center line
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash pattern
}

// Draws the player's car
function drawCar() {
    const x = carBaseX + carOffsetX; // Calculate car's current X position

    // --- CAR BLINK LOGIC ---
    if (carBlinkActive) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - carBlinkStartTime;

        if (elapsedTime > CAR_BLINK_DURATION) {
            carBlinkActive = false; // Stop blinking after duration
        } else {
            // Only draw the car if the current time is within a "visible" interval
            // This creates the blinking effect
            if (Math.floor(elapsedTime / CAR_BLINK_INTERVAL) % 2 === 0) {
                // If the modulo is 0 (even), draw the car. If 1 (odd), don't draw.
                if (carImageLoaded) {
                    ctx.drawImage(carImage, x, carY, carWidth, carHeight); // Draw car image
                } else {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(x, carY, carWidth, carHeight);
                }
            }
            return; // Skip drawing if it's an "invisible" interval or if blinking is active
        }
    }
    // --- END CAR BLINK LOGIC ---

    // Draw the car normally if not blinking, or if blinking has just ended
    if (carImageLoaded) {
        ctx.drawImage(carImage, x, carY, carWidth, carHeight); // Draw car image
    } else {
        // Fallback: draw a red rectangle if car image fails to load
        ctx.fillStyle = 'red';
        ctx.fillRect(x, carY, carWidth, carHeight);
    }
}

// --- HUD DISPLAY FUNCTION ---
// Updates the HTML elements in the control panel to reflect game state
function updateHUDDisplay() {
    hudScore.textContent = score;

    // Convert game speed multiplier to a more intuitive km/h display
    // Assuming gameSpeedMultiplier of 1.0 means a certain base speed (e.g., 100 km/h)
    const kmPerHourBase = 100; // Base km/h when gameSpeedMultiplier is 1.0
    const actualSpeed = Math.round(gameSpeedMultiplier * kmPerHourBase);
    hudSpeed.textContent = `${actualSpeed} km/h`;

    // Max speed for HUD bar (adjust based on your max getSpeedForScore return)
    const maxBarSpeed = getSpeedForScore(20000) * kmPerHourBase; // Max speed for bar (e.g., 4.0 * 100 = 400 km/h)
    const speedPercentage = Math.min(100, (actualSpeed / maxBarSpeed) * 100);
    speedBarFill.style.width = `${speedPercentage}%`;
    let speedBarColor = 'lightgreen';
    // Adjust thresholds based on the new speed range
    if (actualSpeed >= kmPerHourBase * 3.0) speedBarColor = 'red'; // e.g., >300 km/h
    else if (actualSpeed >= kmPerHourBase * 2.0) speedBarColor = 'orange'; // e.g., >200 km/h
    else if (actualSpeed >= kmPerHourBase * 1.5) speedBarColor = 'yellow'; // e.g., >150 km/h
    speedBarFill.style.backgroundColor = speedBarColor;


    hudHealthValue.textContent = `${health}%`;
    // Update health bar fill and color
    const healthPercentage = (health / 100) * 100;
    healthBarFill.style.width = `${healthPercentage}%`;
    let healthBarColor = 'limegreen';
    if (health <= 25) healthBarColor = 'red';
    else if (health <= 50) healthBarColor = 'orange';
    healthBarFill.style.backgroundColor = healthBarColor;
}

// Updates the car's position based on keyboard input
function updateCar(deltaTime) {
    // Calculate movement based on baseCarMoveSpeed (pixels per second) and deltaTime
    const movementAmount = (baseCarMoveSpeed / 1000) * deltaTime; // Convert ms to seconds

    if (keys.left) carOffsetX = Math.max(0, carOffsetX - movementAmount);
    if (keys.right) carOffsetX = Math.min(maxOffset, carOffsetX + movementAmount);
}

// Resets all game state variables to their initial values for a new game
function resetGame() {
    score = 0;
    health = 100;
    gameOver = false;
    lampposts = [];
    gameSpeedMultiplier = getSpeedForScore(0); // Reset speed based on initial score
    lastLamppostY = -200;
    carOffsetX = 0;
    dashOffset = 0;
    healthDrop = null; // Ensure health drop is reset
    healthDrop25PercentGiven = false; // IMPORTANT: Reset the flag for the 25% health drop

    // --- RESET BLIND EFFECT (if still using it) ---
    blindEffectActive = false;
    blindEffectStartTime = 0;
    // --- END RESET BLIND EFFECT ---

    // --- RESET CAR BLINK EFFECT ---
    carBlinkActive = false;
    carBlinkStartTime = 0;
    // --- END RESET CAR BLINK EFFECT ---

    // Stop and reset all sounds
    crashSound.pause();
    crashSound.currentTime = 0;
    gameOverSound.pause();
    gameOverSound.currentTime = 0;
    collectSound.pause();
    collectSound.currentTime = 0;

    nameOverlay.style.display = 'none'; // Hide name input overlay
    updateButtonStates(); // Update button enable/disable states
    updateHUDDisplay(); // IMPORTANT: Update HUD after reset
}

// --- Touch Controls ---
let touchStartX = 0;
// Handles the start of a touch event for car movement
function handleTouchStart(e) {
    if (gameOver || paused) return; // Ignore touch if game is over or paused
    touchStartX = e.touches[0].clientX; // Record initial touch X position
}

// Handles touch movement for car steering
function handleTouchMove(e) {
    if (gameOver || paused) return; // Ignore touch if game is over or paused
    const touchMoveX = e.touches[0].clientX;
    const deltaX = touchMoveX - touchStartX;

    // The sensitivity of touch movement relative to horizontal car speed
    // This factor might need fine-tuning based on how responsive you want touch to be.
    const touchSensitivityFactor = 0.5; // Controls how much touch movement affects car speed

    // Calculate movement amount based on normalized touch delta and baseCarMoveSpeed
    // Multiplying by touchSensitivityFactor to adjust responsiveness.
    const movementAmount = (baseCarMoveSpeed / 1000) * Math.abs(deltaX) * touchSensitivityFactor;

    if (deltaX > 0) { // Moving right
        carOffsetX = Math.min(maxOffset, carOffsetX + movementAmount);
    } else if (deltaX < 0) { // Moving left
        carOffsetX = Math.max(0, carOffsetX - movementAmount);
    }
    touchStartX = touchMoveX; // Update start position for continuous movement
}

// --- Game Loop ---
// The main animation loop for the game
let lastTimestamp = 0; // Declare and initialize lastTimestamp outside animate

function animate(timestamp) {
    if (paused || gameOver) return; // Stop animation if game is paused or over

    // Calculate deltaTime: time elapsed since the last frame in milliseconds
    // Clamp deltaTime to prevent super jumps/stutters if a very long frame occurs (e.g., tab switch)
    const MAX_DELTA_TIME = 100; // Cap at 100ms (corresponds to 10 FPS minimum for one frame)
    const deltaTime = Math.min(timestamp - lastTimestamp, MAX_DELTA_TIME);
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas

    updateCar(deltaTime); // Update car position with deltaTime
    drawRoad(); // Draw the road
    updateLampposts(deltaTime); // Update lampposts (obstacles) and handle collisions with deltaTime
    updateHealthDrop(deltaTime); // Update health pickup and handle collection with deltaTime
    drawCar(); // Draw the car

    // --- DRAW BLIND EFFECT (if you want this as a separate, optional effect) ---
    if (blindEffectActive) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - blindEffectStartTime;
        if (elapsedTime < BLIND_EFFECT_DURATION) {
            const opacity = 0.8 * (1 - (elapsedTime / BLIND_EFFECT_DURATION));
            ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            blindEffectActive = false; // Deactivate when duration is over
        }
    }
    // --- END DRAW BLIND EFFECT ---

    updateHUDDisplay(); // Update the HTML HUD elements

    // Animate road dashes based on game speed and deltaTime
    // dashSpeedFactor controls how fast the dashes scroll relative to obstacles.
    // Adjust it to make the road feel faster/slower relative to objects.
    const dashSpeedFactor = 0.5; // Increased to make dashes more noticeable with higher speeds
    dashOffset = (dashOffset + (gameSpeedMultiplier * baseObstacleSpeed / 1000) * deltaTime * dashSpeedFactor) % 60;

    animationId = requestAnimationFrame(animate); // Request next animation frame
}

// --- Initial Setup ---
// Call init functions when the window loads to ensure DOM is ready
window.onload = () => {
    displayHighScores(); // Load and display high scores on startup
    updateButtonStates(); // Set initial button states (Play enabled, Pause disabled)
    updateHUDDisplay(); // IMPORTANT: Call once at startup to populate the HUD

    // --- Call the new timer function and set up interval ---
    updateResetTimerDisplay(); // Call once immediately
    setInterval(updateResetTimerDisplay, 1000); // Update every second
    // Game starts paused by default, waiting for user to click 'Play'
};