# TruckNavAdvanced

**External GPS Navigation System for Euro Truck Simulator 2 and American Truck Simulator**

TruckNavAdvanced is a real-time external GPS navigation system built with TypeScript and Vue.js. It transforms any device with a web browser — phone, tablet, or secondary monitor — into a fully featured navigation display for ETS2 and ATS. The system connects to the SCS Telemetry SDK to provide live tracking, custom graph-based routing, and an immersive driving interface.

<p align="center">
  <img src="preview.png">
</p>

---

## Features

### Navigation and Routing
- **Real-Time Navigation:** Live truck tracking with automatic camera follow, smooth rotation, and pitch adjustment.
- **Custom Routing Engine:** A dedicated A*-based pathfinding algorithm powered by a pre-compiled road network graph, with support for edge-exclusion alternative routes.
- **Route Type Selection:** Choose between **Fastest** (time-optimized, default) or **Shortest** (distance-optimized) routing modes.
- **Avoid Ferries:** Toggle to add heavy cost penalties to ferry edges, keeping routes on land.
- **Alternative Routes:** The engine computes a secondary path alongside the primary route, displayed as a selectable overlay with time, distance, and traffic comparison.
- **Alternative Route Traffic Visualization:** Both primary and alternative routes display per-segment traffic congestion colors (green, orange, red) on the map.
- **Route Selection Card:** A route comparison card showing time difference, traffic delay badges, ETA, and distance statistics, with keyboard accessibility and multi-language support.
- **Alt Route Swap Card:** After route confirmation, the alt route swap card shows traffic delay estimates alongside ETA and distance.
- **Traffic-Adjusted ETA:** Estimated time of arrival dynamically calculated using current truck speed and real-time congestion data from TruckersMP, with a continuous density-to-delay model.
- **Route Path Progress:** Driven segments of the route fade to grey, reducing visual clutter on complex interchanges.
- **Rerouting Detection:** Automatic deviation detection triggers route recalculation with visual feedback and voice notification.

### ManeuverCard UI
- **Turn Direction Icons:** SVG-based directional indicators showing turn type (left, right, exit, roundabout) with active color highlighting.
- **Exit Number Badges:** Highway exit numbers (Exit 23) and roundabout exit numbers displayed both as icon badges and inline text chips colored to match the route color.
- **Long Straight Instruction:** When the next turn is more than 10 km away, the card displays a contextual straight-ahead message with priority-based content: exit number, destination city, or plain distance.
- **Destination-Based Direction Text:** The straight instruction dynamically includes the destination city name when available (for example, "Continue towards Frankfurt for 45 km").

### Map and Display
- **Auto Day/Night Theme:** The interface automatically switches between light and dark modes based on the in-game time of day.
- **Auto-Zoom on Turns:** Camera automatically pitches and zooms when approaching complex intersections or exits (configurable distance threshold).
- **3D Map Mode:** Toggle between 2D and 3D camera perspectives.
- **Auto-Follow Mode:** Camera follows the truck with smooth rotation — can be disabled for free-form map exploration.
- **Keep Screen On:** Prevents device display from turning off during navigation (Capacitor KeepAwake).
- **Floating Speedometer:** A minimal speed display with an integrated speed limit badge that highlights when exceeding the limit.
- **Speed Alert Overlay:** A prominent pulsing red top-bar alert when speeding — displays current speed vs. limit, auto-hides when slowing down, with toggle in Navigation settings.
- **Traffic Progress Bar:** A bottom-of-screen indicator showing congestion levels along the active route using TruckersMP data.
- **Route Overview:** One-tap zoom to view the full remaining route, then seamless return to follow mode.
- **Per-Category POI Icons:** Individual toggles for **Gas Stations**, **Service/Repair**, **Truck Dealers**, and **Other POIs** (parking, garages, toll, weigh stations).
- **City Labels:** Toggle city, village, and country name visibility on the map.
- **Road Sprites:** Speed limit signs, curves, and other road-type icons displayed separately from POI categories.
- **Glassmorphism UI:** Translucent, backdrop-blurred interface elements with smooth transitions.

### Voice Guidance
- **Multi-Tier Turn Announcements:** Google Maps-style voice directions at configurable distances (5 km, 2 km, 500 m, immediate), with combined instructions for closely spaced turns.
- **Long Straight Announcements:** Voice reads the straight-ahead message with the same contextual priority as the ManeuverCard UI — exit number, destination city, or plain distance.
- **Speed Limit Warning:** Audio alert when speed exceeds the limit by 5%, speaking the actual limit and current speed (e.g., "Limit 80 km/h, you are driving 95"). Repeats every 15s on initial exceed and every 20s per 5 km/h increment.
- **Speed Alert Toggle:** Enable/disable the visual speeding overlay independently of voice settings.
- **Traffic Alert Voice:** Spoken notification when congestion is detected along the active route.
- **Reroute Voice:** Spoken notification when the system automatically recalculates the route due to deviation.
- **Arrival Voice:** Two-stage arrival notification — "approaching destination" at 500 m remaining, and "arrived" upon reaching the destination.
- **German Language Support:** Full voice direction and UI localization in German, including locale-appropriate terms (Ausfahrt, in Richtung, Kreisverkehr).
- **Per-Category Toggles:** Individual on/off switches for each voice warning category (speeding, turn tiers, traffic alerts, long straight).
- **Voice Language Selection:** Choose from available system TTS voices, with automatic locale-based fallback.
- **Test Voice Button:** Play a sample message to verify voice output and volume.

### Performance
- **Spatial Grid Traffic Optimization:** Grid-based spatial hashing accelerates traffic point lookups during A* pathfinding, improving routing performance on dense traffic data.
- **Web Worker Routing:** Pathfinding runs in a dedicated Web Worker to keep the UI responsive.

### Settings (6 Tabs)
| Tab | Features |
|-----|----------|
| **General** | DLC selection, Units (Metric/Imperial), Keep Screen On, Language, Reset to Defaults |
| **Appearance** | Theme Color, Text Theme (Light/Dark), Route Color, Font, HUD/Compact sizes, Driving Info components |
| **Navigation** | Guided Nav, Auto-Follow, 3D Mode, Auto-Zoom Distance, Route Type, Avoid Ferries, Traffic toggle + Server select, Map Display (POI categories, City Labels, Speed Alert) |
| **Voice** | Voice Warnings toggle, Language selection, Per-category toggles, Distance thresholds, Test Voice |
| **Plugin** | Connection (dynamic IP check), Plugin Status, Auto-Start (Electron) |
| **Data** | Storage usage, Recent Destinations, Map Data files listing, Reset/Clear All |

### Localization
- **Multi-Language Support:** Full interface localization in English, German, and Thai, including route descriptions, voice guidance messages, and direction labels.

---

## Compatibility

| Component | Status |
|-----------|--------|
| ETS2 / ATS | Supported up to version 1.59.1.3 (map data regenerated from game files) |
| Official DLCs | All map expansions supported |
| Map Mods (ProMods, etc.) | Not currently supported |
| Platform | Web (any browser), Android (APK), Windows (Electron), macOS (Electron), iOS (Capacitor) |

### Known Limitations

- Routing may behave unpredictably inside custom company prefab yards; driving toward the exit typically resolves pathfinding.
- Mods that modify vanilla company names (except those by MLH82) may cause routing failures.
- Toll road avoidance is not available — game map data does not include toll road flags in the road network graph.

---

## Installation

### Option A: Standalone Executable (Windows)

1. Download the latest Windows installer from the [Releases](https://github.com/KongGithubDev/TruckNav-Sim-Advanced/releases) page.
2. Run the installer and launch the application.
3. For mobile use, install the APK or open a browser and navigate to the IP address shown in the desktop app.

### Option B: Android APK

1. Download the latest APK from the [Releases](https://github.com/KongGithubDev/TruckNav-Sim-Advanced/releases) page.
2. Enable installation from unknown sources on your device.
3. Install the APK and pair with the desktop application.

### Option C: From Source

**Prerequisites:** [Node.js (LTS)](https://nodejs.org/) and [Git](https://git-scm.com/).

```bash
git clone https://github.com/KongGithubDev/TruckNav-Sim-Advanced.git
cd TruckNav-Sim-Advanced
npm install
npx nuxi dev --host 0.0.0.0
```

Access the application at `http://<your-local-ip>:3000`.

> **Windows note:** If you encounter script execution errors, run PowerShell as Administrator and execute:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

### Building from Source

```bash
# Windows EXE
npm run electron:make

# Android APK
npx cap sync android
cd android && ./gradlew assembleDebug

# macOS DMG
cd electron && npm run electron:make -- --mac
```

---

## Map Data

City coordinates, company locations, and road network data are extracted directly from the latest ETS2 / ATS game files using the [truckermudgeon/maps](https://github.com/truckermudgeon/maps) parser toolchain. To regenerate the map data after a game update:

```bash
# 1. Clone the parser toolchain
git clone --recurse-submodules https://github.com/truckermudgeon/maps.git
cd maps
npm install
npm run build -w packages/clis/parser

# 2. Parse the game files
npx parser -i "path/to/Euro Truck Simulator 2" -o ./parsed

# 3. Convert to project format (see app/scripts/)
node app/scripts/convert.mjs
```

---

## Architecture

1. **Telemetry Bridge** — The application connects to the SCS SDK Telemetry server to receive real-time vehicle data (position, speed, heading, job info).
2. **Coordinate Conversion** — Game-space coordinates are transformed to WGS84 (geographic) coordinates for rendering on a MapLibre GL JS map.
3. **Custom Graph Routing** — A pre-compiled road network graph is loaded into a Web Worker, where A* pathfinding computes optimal routes with support for DLC filtering, ferry detection, route type (fastest/shortest), and alternative path generation.

---

## Contributing

If you encounter routing errors (illegal turns, missing roads, broken paths), please report them via [GitHub Issues](https://github.com/KongGithubDev/TruckNav-Sim-Advanced/issues).

Include a description and screenshot of the issue when possible.

---

## Acknowledgements

- [@truckermudgeon](https://github.com/truckermudgeon) — The `maps` repository provides the foundational logic for map parsing, WGS84 coordinate conversion, and the extraction tools used to regenerate city and company location data from the latest game files.
- [@RenCloud](https://github.com/RenCloud) — The `scs-sdk-plugin` project made telemetry communication between the game and web environment possible.
- [@Rares-Muntean](https://github.com/Rares-Muntean) — TruckNavAdvanced is a fork of @Rares-Muntean's TruckNav-Sim, extended with alternative routing, live traffic visualization, voice guidance, auto day/night theme, multi-language support, POI category toggles, route type selection, speed alert system, and numerous refinements.
