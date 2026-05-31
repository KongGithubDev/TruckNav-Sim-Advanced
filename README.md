<div align="center">
  <h1>🚛 TruckNav-Sim-Advanced</h1>
  <p><strong>The Ultimate External GPS Navigation System for Euro Truck Simulator 2 & American Truck Simulator</strong></p>
</div>

<br />

**TruckNav-Sim-Advanced** is a next-generation, external GPS navigation system built with TypeScript and Vue.js. It transforms any device (phone, tablet, or second monitor) into a fully functional, highly interactive GPS for your ETS2/ATS journeys. Operating via an intuitive web interface, it provides real-time tracking, intelligent routing, and an immersive driving experience.

---

## 🌟 The Google Maps Experience

We've completely overhauled the UI and feature set to deliver a modern, premium navigation experience reminiscent of real-world apps like Google Maps:

*   🗣️ **Intelligent Voice Warnings (Siri):** Audio alerts for overspeeding, customizable to your system's language (including Thai).
*   🌙 **Auto Day/Night Theme:** The UI dynamically switches to Dark Mode perfectly synced with in-game nighttime hours.
*   🏎️ **3D Perspective Driving Mode:** Tilt the camera and enable auto-follow for a seamless, 3D navigation perspective.
*   🔍 **Floating Smart Search:** Instantly search for any city or destination and pan the map with a single click.
*   🚦 **Live Traffic Progress Bar:** A visual indicator at the bottom of the screen displaying traffic congestion levels (Green/Orange/Red) along your active route.
*   🕒 **Traffic-Adjusted ETA:** Your Estimated Time of Arrival dynamically updates, adding delay minutes based on real-time server traffic data.
*   🏙️ **Current Location HUD:** Always know your exact location with a floating badge displaying your current city and country.
*   🎨 **Glassmorphism UI:** A sleek, translucent, and modern Material Design aesthetic with backdrop blurring and smooth animations.

---

## 📊 Compatibility & Status

Currently in **Active Development / Beta**. While the core navigation engine is robust, the custom routing graph (built via QGIS) is continually being refined to handle complex intersections and prefabs.

*   ✅ **ATS / ETS2 Version:** Fully supported up to **1.59**
*   ✅ **Supported DLCs:** All official map expansions
*   ❌ **Map Mods:** ProMods and other structural map mods are currently unsupported.

### ⚠️ Known Limitations
*   **Company Prefabs:** Routing may occasionally struggle deep within custom company yards. Slowly moving towards the exit usually resolves pathfinding.
*   **Company Name Mods:** Using mods that alter vanilla company names (other than those by **MLH82**) may break routing.

---

## 🚀 Installation & Setup

You can run TruckNav-Sim-Advanced via a standalone executable or build it from the source using Node.js.

### Option A: Quick Install (.exe)
1. Download the latest setup file from the [Releases](https://github.com/KongGithubDev/TruckNav-Sim-Advanced/releases) page.
2. Run the installer and launch the application on your PC.
3. To use on a mobile device, install the provided `.apk` or simply open your device's web browser and enter the local IP address displayed in the PC app.

### Option B: Node.js / Developer Setup
**Prerequisites:** [Node.js (LTS)](https://nodejs.org/) and [Git](https://git-scm.com/).

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/KongGithubDev/TruckNav-Sim-Advanced.git
   cd TruckNav-Sim-Advanced
   ```

2. **Windows Execution Policy (If needed):**
   Open PowerShell as Administrator and run:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

3. **Install Dependencies & Run:**
   ```bash
   npm install
   npx nuxi dev --host 0.0.0.0
   ```
4. Access the app via your local network IP (e.g., `http://192.168.1.X:3000`).

---

## ⚙️ How It Works

1.  **Telemetry Bridge:** The app connects to the SCS SDK Telemetry server, extracting real-time vehicle data (coordinates, speed, heading).
2.  **Coordinate Conversion:** Game engine coordinates are mathematical translated into standard **WGS84** geographical projections for seamless integration with MapLibre GL JS.
3.  **Custom Graph Routing:** A bespoke routing algorithm calculates the optimal path across a massive pre-compiled graph of the game world's road network.

---

## 🤝 Contributing & Bug Reporting

Help us perfect the map! If you discover illegal U-turns, broken routing, or missing roads, please report them.

**What to include:** A brief description and a screenshot of the issue.
**Where to report:** [GitHub Issues](https://github.com/KongGithubDev/TruckNav-Sim-Advanced/issues) or via our Discord community.

---

## 🙏 Credits & Acknowledgements

*   **[@truckermudgeon](https://github.com/truckermudgeon):** For the pioneering `maps` repository. The foundational logic for map parsing and WGS84 conversion made this project possible.
*   **[@RenCloud](https://github.com/RenCloud):** For the incredible `scs-sdk-plugin`, the essential bridge communicating between the game engine and the web environment.

<div align="center">
  <i>Drive safe, and happy trucking!</i>
</div>
