# 🧬 MiLife Prototype Engine

An advanced, interactive hierarchy visualization engine built using **HTML5**, **CSS3**, and **D3.js**. The MiLife Prototype takes raw JSON datasets of network connections and auto-generates a dynamic, fully-explorable network tree map.

## ✨ Core Features

* **Interactive D3.js Visualization**: Beautifully animates and plots complex network hierarchies. Each user is represented as a sleek capsule containing their Name, ID, and Status.
* **Smart "Missing Children" Engine**: Automatically calculates empty binary branches (Left/Right) in the network and renders translucent placeholder blocks ("MC") to indicate where the network needs to grow.
* **Advanced Global Search**: Instantly filter and find users by their `codeName` or `userId`. Provides a dedicated "Results Tray" showing matches.
* **Spotlight & Rail Highlighting**: Activating any node (via click or search) dims out the irrelevant portions of the tree and instantly illuminates the direct hierarchy "rail" (ancestors and descendants). The active node receives a highly visible, shimmering red ring.
* **Real-time Data Pane**: Clicking a node fires up the "Right Pane," a dual-section interface that calculates and displays:
  * **Node Info**: Name, ID, Color, Status, and Active Children.
  * **Sponsor Info & Stats**: Sponsor Name/ID, Branch side, absolute Tree Level, and the exact number of Levels Below the current node.
* **Network Statistics**: The Left Pane acts as a dashboard calculating real-time network intelligence, including Max Depth, Total Network Size (excluding missing branches), and Total Pending missing children.
* **Fully Responsive**: Carefully engineered CSS automatically scales the 3-pane layout into a beautiful, stacked mobile layout on screens `<768px`, ensuring typography remains legible and touch-interactions remain smooth.
* **Optimized Mobile Panning**: Overrides native browser swipe gestures to ensure smooth, responsive 1-finger panning and 2-finger zooming on touchscreen devices.

---

## 🛠️ Technology Stack

1. **Vanilla JavaScript (ES6)**: No heavy front-end frameworks. High performance logic.
2. **D3.js (v7)**: Powers the mathematical tree plotting, SVG rendering, and smooth CSS transitions.
3. **Vanilla CSS3**: Utilizes CSS Grid, Flexbox, native CSS Variables (`:root`), and advanced `@keyframes` animations (e.g. `red-shimmer`).
4. **HTML5**: Semantically structured for standard viewing.

---

## 📂 Project Structure

* `index.html`: The core dashboard layout, importing external fonts (Google Outfit) and housing the 3-pane UI.
* `style.css`: Contains the entire design system, color tokens, animations, and the dedicated `@media` query section for mobile scaling.
* `script.js`: The central logic engine. Loads data, parses missing children, manages D3 states, and handles DOM manipulations for search and data panes.
* `data.json`: The dataset mimicking a database payload containing `data_dump` (user details) and `connections` (hierarchy paths).

---

## 🚀 Getting Started

Because the engine fetches a local `data.json` file using the native JavaScript `fetch()` API, running the project directly from the file system (e.g., `file:///`) may cause a CORS policy block on some modern browsers. 

To view the prototype locally:
1. Open the folder in VS Code.
2. Use an extension like **Live Server**.
3. Alternatively, run a simple python server in your terminal: `python -m http.server 8000`.
4. Navigate to `http://localhost:8000` in your web browser.

---

## 🎨 Design System

* **Typography**: Google Font *Outfit* (Weights 300, 400, 600, 700).
* **Base Theme**: Pure white cards on a bright creme background (`#fcf9f2`) with glassmorphism effects (`backdrop-filter: blur()`).
* **Accents**: Rich Gold (`#c5a059`) for primary borders/accents, Bright Aqua (`#20b2aa`) for primary call-to-actions, and Red (`#ff4757`) for warnings and the spotlight ring.
