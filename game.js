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
const moveSpeed = 4;
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
let lamppostSpeed = 1; // Initial speed multiplier
let lastLamppostY = -200;
const keys = { left: false, right: false };
let healthDrop = null; // { x, y, active }
let animationId = null;
let paused = true; // Start paused

// Flag to track if the specific 25% health drop has been given in the current game
let healthDrop25PercentGiven = false;

// Image Loading Status
let carImageLoaded = false;
let beerImageLoaded = false;
let heartImageLoaded = false; // For health drops

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

// Game Assets - Ensure these image paths are correct relative to your HTML file
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
        animate();
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
    animate(); // Start a new game loop
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
}

// Renders the high scores list on the scoreboard
function displayHighScores() {
    const scores = getHighScores();
    highScoresList.innerHTML = scores.map((e, i) => `<li>${i + 1}. ${e.name}: ${e.score}</li>`).join('');
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
function updateLampposts() {
    // Spawn new lamppost if needed (when current ones are far enough)
    if (!gameOver && (lampposts.length === 0 || canvas.height - lastLamppostY > 200)) {
        spawnLamppost();
    }

    const carX = carBaseX + carOffsetX;
    // Iterate through lampposts from back to front to handle splice correctly
    for (let i = lampposts.length - 1; i >= 0; i--) {
        const l = lampposts[i];
        l.y += lamppostSpeed; // Move lamppost down

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
        if (!l.checked && rectCircleColliding(l.x, l.y, 10, carX, carY, carWidth, carHeight)) {
            l.checked = true; // Mark as checked to prevent multiple hits from one lamppost
            crashSound.currentTime = 0; // Rewind sound to play from start
            crashSound.play();
            health -= 25; // Decrease health
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
                lamppostSpeed = getSpeedForScore(score); // Adjust speed based on score
                updateHUDDisplay(); // Update HUD after score/speed change
            }
        }
    }
}

// Updates position of health drop and handles collisions
function updateHealthDrop() {
    // Only proceed if a health drop exists and is active
    if (!healthDrop || !healthDrop.active) return;

    healthDrop.y += lamppostSpeed; // Move health drop down with game speed

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

    if (score < 1000) return 1.0; // Corresponds to 100 km/h (base speed)
    if (score < 1500) return 1.5; // Approx 107.69 km/h - adjust as needed
    if (score < 2000) return 2.0; // Approx 115.38 km/h
    if (score < 2500) return 2.5; // Approx 123.07 km/h
    if (score < 3000) return 3.0; // Approx 130.76 km/h
    if (score < 3500) return 3.5; // Approx 138.46 km/h
    if (score < 4000) return 4.0; // Approx 146.15 km/h
    if (score < 4500) return 4.5; // Approx 153.84 km/h
    if (score < 5000) return 5.0; // Approx 161.53 km/h
    if (score < 7500) return 5.5; // Let's keep increasing the base speed gradually
    // Decrease speed
    if (score < 8500) return 4.5; // Decrease to match 450 km/h (need to adjust this multiplier)
    // Increase speed again
    if (score < 10000) return 6.0; // Increase to match 550 km/h (need to adjust this multiplier)
    // You can continue this pattern
    if (score < 12000) return 6.5;
    if (score < 14000) return 7.0;
    if (score < 16000) return 7.5; // Or set a new decrease/increase pattern
    if (score < 18000) return 6.8; // Example decrease
    if (score < 20000) return 8.0; // Example increase

    // Default or max speed if score goes beyond defined thresholds
    return 8.5; // A new maximum speed
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


    const actualSpeed = Math.round(100 + (lamppostSpeed - 1) * 100);
    hudSpeed.textContent = `${actualSpeed} km/h`;

    const maxBarSpeed = 600;
    const speedPercentage = Math.min(100, (actualSpeed / maxBarSpeed) * 100);
    speedBarFill.style.width = `${speedPercentage}%`;
    let speedBarColor = 'lightgreen';
    if (actualSpeed >= 500) speedBarColor = 'red';
    else if (actualSpeed >= 400) speedBarColor = 'orange';
    else if (actualSpeed >= 300) speedBarColor = 'yellow';
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
function updateCar() {
    if (keys.left) carOffsetX = Math.max(0, carOffsetX - moveSpeed);
    if (keys.right) carOffsetX = Math.min(maxOffset, carOffsetX + moveSpeed);
}

// Resets all game state variables to their initial values for a new game
function resetGame() {
    score = 0;
    health = 100;
    gameOver = false;
    lampposts = [];
    lamppostSpeed = getSpeedForScore(0); // Reset speed based on initial score
    lastLamppostY = -200;
    carOffsetX = 0;
    dashOffset = 0;
    healthDrop = null; // Ensure health drop is reset
    healthDrop25PercentGiven = false; // IMPORTANT: Reset the flag for the 25% health drop

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

    // Move car based on touch direction, with faster movement for touch
    if (deltaX > 0) { // Moving right
        carOffsetX = Math.min(maxOffset, carOffsetX + moveSpeed * 2);
    } else if (deltaX < 0) { // Moving left
        carOffsetX = Math.max(0, carOffsetX - moveSpeed * 2);
    }
    touchStartX = touchMoveX; // Update start position for continuous movement
}

// --- Game Loop ---
// The main animation loop for the game
function animate() {
    if (paused || gameOver) return; // Stop animation if game is paused or over

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas

    updateCar(); // Update car position
    drawRoad(); // Draw the road
    updateLampposts(); // Update lampposts (obstacles) and handle collisions
    updateHealthDrop(); // Update health pickup and handle collection
    drawCar(); // Draw the car
    updateHUDDisplay(); // Update the HTML HUD elements

    dashOffset = (dashOffset + lamppostSpeed * 0.5) % 60; // Animate road dashes based on speed
    animationId = requestAnimationFrame(animate); // Request next animation frame
}

// --- Initial Setup ---
displayHighScores(); // Load and display high scores on startup
updateButtonStates(); // Set initial button states (Play enabled, Pause disabled)
updateHUDDisplay(); // IMPORTANT: Call once at startup to populate the HUD
// Game starts paused by default, waiting for user to click 'Play'
