# BrewBash

## 🎮 About the Game

BrewBash is a simple yet addictive browser-based game where you navigate a car on a winding road, dodging obstacles (represented as beer bottles) and collecting health pickups (hearts). The game challenges your reflexes as the speed increases with your score. Be careful though, hitting too many obstacles will lead to a game over\! Compete for the highest score, with weekly leaderboards adding an extra layer of challenge.

## ✨ Features

  * **Responsive Car Controls:** Use keyboard arrows/A/D keys or touch controls on mobile to steer your car.
  * **Dynamic Speed:** The game's speed increases as your score goes up, offering a progressive challenge.
  * **Health System:** Avoid obstacles to maintain your health, or look out for health pickups to recover.
  * **High Score Leaderboard:** Compete with yourself and others\! Your top 10 scores are saved locally and reset weekly for fresh competition.
  * **Interactive HUD:** Keep track of your **Score**, **Speed (km/h)**, and **Health (%)** in real-time.
  * **Sound Effects:** Engaging sound effects for crashes, pickups, and game over.
  * **Pause/Play/Restart:** Full control over the game flow.

## 🚀 How to Play

1.  **Clone or Download:** Get the game files to your local machine.
2.  **Open `index.html`:** Simply open the `index.html` file in your web browser.
3.  **Start Game:** Click the **"Play"** button to begin.
4.  **Steer Your Car:**
      * **Keyboard:** Use the **Left Arrow** or **'A'** key to move left, and the **Right Arrow** or **'D'** key to move right.
      * **Touch (Mobile):** Touch and drag left or right on the canvas to steer.
5.  **Dodge Obstacles:** Avoid the beer bottles that appear on the road. Colliding with them reduces your health.
6.  **Collect Health:** Pick up heart icons to restore your health.
7.  **Score Points:** Each obstacle you successfully dodge increases your score.
8.  **Game Over:** If your health drops to zero, the game ends. You'll then be prompted to enter your name for the high score board.

## ⚙️ Project Structure

The game is built primarily with HTML, CSS, and JavaScript, leveraging the Canvas API for graphics.

```
.
├── index.html              # Main game page
├── style.css               # Styling for the game elements and HUD
├── script.js               # Core game logic and functionality
├── car.png                 # Player car image
├── beer.png                # Obstacle image (beer bottle)
├── heart.png               # Health pickup image
├── crash.mp3               # Sound effect for collisions
├── gameover.mp3            # Sound effect for game over
└── collect.mp3             # Sound effect for collecting items
```

## 🛠️ Setup (for development)

To run this project locally:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/drunk-dodge.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd drunk-dodge
    ```
3.  **Open `index.html`:** You can simply open this file directly in your web browser. No special server setup is required.

## 🤝 Contributing

Contributions are welcome\! If you have suggestions for improvements, new features, or bug fixes, feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

---

## 🧑‍💻 Author

**Sarash Sahu**
🎓 MCA Final Year Project
🔗 [LinkedIn](https://www.linkedin.com/in/sarashsahu)

---

