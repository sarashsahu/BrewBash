# BrewBash

## 🎮 About the Game

BrewBash is a browser-based arcade game where you steer a car along a road, dodging falling beer bottles and collecting health pickups (hearts). The speed increases as your score climbs. Hit too many bottles and your health drops to zero!

## ✨ Features

  * **Responsive Layout & Controls:** Works on desktop and mobile screens using `A`/`D` or Left/Right arrow keys, plus on-screen touch/click buttons.
  * **Dynamic Speed:** Game speed scales up as your score increases.
  * **Health System:** Avoid obstacles to keep your health up, and grab heart drops when health gets low.
  * **Interactive HUD:** Real-time **Score**, **Speed (km/h)**, and **Health** bar.
  * **Sound Effects:** Audio feedback for collisions, pickups, and game over.
  * **Play / Pause / Restart:** Full control over the game flow with a 3-second countdown on resume.

## 🚀 How to Play

1.  **Open `index.html`** in your web browser (or serve the folder over a local static server).
2.  **Tap or click** the start screen to begin the countdown.
3.  **Steer Your Car:**
      * **Keyboard:** Use **Left/Right Arrow** or **A/D** keys.
      * **Mobile / Touch:** Hold the **&lt;** and **&gt;** buttons below the road.
4.  **Dodge Obstacles:** Avoid the beer bottles; each hit reduces your health by 25% and grants brief blink invulnerability.
5.  **Collect Health:** Pick up hearts to restore 25% health.

## ⚙️ Project Structure

```
.
├── index.html                  # Game markup and HUD structure
├── css/
│   └── style.css               # Responsive layout, HUD, and overlay styles
├── js/
│   └── script.js               # 4-lane highway canvas game engine & controls
└── assets/
    ├── images/
    │   ├── beer.png            # Obstacle image (beer bottle)
    │   ├── car.png             # Player car image
    │   └── heart.png           # Health pickup image
    └── audio/
        ├── crash.mp3           # Sound effect for collisions
        ├── gameover.mp3        # Sound effect for game over
        └── health.mp3          # Sound effect for collecting hearts
```

## 🛠️ Setup (for development)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sarashsahu/BrewBash.git
    ```
2.  **Open `index.html`** directly in a browser, or run any static file server in the folder.

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
🎓 MCA Final Year 2025
🔗 [LinkedIn](https://www.linkedin.com/in/sarashsahu)

---

