import { ref, watch } from "vue";
import type { Map as MapLibreGl } from "maplibre-gl";
import {
    convertEts2ToGeo,
    convertAtsToGeo,
    convertGeoToEts2,
    convertGeoToAts,
} from "~/assets/utils/map/converters";
import type { GameType } from "~/types";

export interface TrafficPlayer {
    name: string;
    x: number;
    y: number;
    heading: number;
    mpId: number;
    playerId: number;
    serverId: number;
    speed?: number;
}

export interface TrafficPoint {
    coordinates: [number, number];
    weight: number;
    speed?: number; // 0-1 normalized speed (0=stopped, 1=full speed)
}

export interface RouteTrafficInfo {
    averageDensity: number;
    totalPlayers: number;
    congestedSegments: number; // Kept for route coloring, but delay uses weighted sum
    routeColors: string[]; // Colors for each segment of the route
    trafficDelayMinutes: number; // Gradual traffic delay in in-game minutes
}



const POLL_INTERVAL = 10000; // 10 seconds

const trafficPoints = ref<TrafficPoint[]>([]);
const routeTrafficInfo = ref<RouteTrafficInfo | null>(null);
const isTrafficLoading = ref(false);
const trafficEnabled = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentMap: MapLibreGl | null = null;
let currentGame: GameType = "ets2";

// Track player positions across polls to calculate approximate speed
interface PositionRecord {
    x: number;       // game-space X
    y: number;       // game-space Y
    time: number;    // timestamp
}
const playerHistory = new Map<number, PositionRecord>();

// Game coords displacement → approximate km/h (ETS2/ATS scale)
// At 90 km/h, a truck moves ~0.025 game-units per second
// So displacement per polling interval (10s): ~0.25 units at 90 km/h
function estimateSpeedKph(gameUnitsPerSec: number): number {
    // ~90 km/h ≈ 0.025 units/sec → speedKph = gameUnitsPerSec * (90 / 0.025)
    return gameUnitsPerSec * 3600;
}

function speedToScore(speedKph: number): number {
    // Normalize to 0-1: 0=stopped, 1=≥90 km/h
    return Math.min(speedKph / 90, 1);
}

function distanceToSegment(
    point: [number, number],
    segmentStart: [number, number],
    segmentEnd: [number, number],
): number {
    const [px, py] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;

    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx: number, yy: number;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

export function calculateRouteTrafficInfo(
    points: TrafficPoint[],
    routePath: [number, number][],
    radius = 0.025 // ~2.5km radius per sample point
): RouteTrafficInfo | null {
    if (!routePath || routePath.length < 2) return null;

    const SAMPLE_STEP = 15; // Sample every 15 route points (~750m at 50m/point)
    const totalSegments = routePath.length - 1;
    const routeColors: string[] = new Array(totalSegments).fill(null);
    let totalPlayersOnRoute = 0;
    let congestedSegmentsCount = 0;
    let cumulativeDelayMin = 0;

    // Gradual delay function based on player density AND speed per sample (~750m stretch)
    // playerCount: number of nearby players
    // avgSpeed: 0-1 score (0=stopped, 1=≥90 km/h)
    function sampleDelayMinutes(playerCount: number, avgSpeed?: number): number {
        // Base delay from density
        let delay: number;
        if (playerCount <= 1) delay = 0;
        else if (playerCount <= 4) delay = (playerCount - 1) * 0.3;
        else if (playerCount <= 11) delay = 0.9 + (playerCount - 4) * 0.6;
        else delay = 5.1 + (playerCount - 11) * 1.0;

        // If speed data available: adjust delay — slower = more delay, faster = less delay
        if (avgSpeed !== undefined && playerCount > 1) {
            // speedFactor: 1.5x delay when stopped, 0.5x delay when full speed
            const speedFactor = 1.5 - avgSpeed;
            delay = delay * Math.max(speedFactor, 0.3);
        }

        return delay;
    }

    function computeTrafficColor(playersNear: number, avgSpeed?: number): { color: string | null; isCongested: boolean } {
        // With speed data: adjust thresholds by speed
        // Slower speed = more sensitive (thresholds lowered by up to 2x)
        // Full speed = original thresholds (avoids false red on busy highways)
        // Sampling radius ~2.8km, so thresholds reflect realistic player density per ~2.8km stretch
        if (avgSpeed !== undefined) {
            const speedAdj = 0.5 + avgSpeed * 0.5; // 0.5 (stopped) → 1.0 (full speed)
            const redThreshold = Math.round(30 * speedAdj);   // 15 → 30
            const oraThreshold = Math.round(15 * speedAdj);   // 8 → 15
            const grnThreshold = Math.round(8 * speedAdj);    // 4 → 8

            if (playersNear >= redThreshold) {
                return { color: "#f44336", isCongested: true };
            }
            if (playersNear >= oraThreshold) {
                return { color: "#ff9800", isCongested: false };
            }
            if (playersNear >= grnThreshold) {
                return { color: "#4caf50", isCongested: false };
            }
            return { color: null, isCongested: false };
        }

        // Fallback: count only (no speed data available)
        if (playersNear >= 30) {
            return { color: "#f44336", isCongested: true };
        }
        if (playersNear >= 15) {
            return { color: "#ff9800", isCongested: false };
        }
        if (playersNear >= 8) {
            return { color: "#4caf50", isCongested: false };
        }
        return { color: null, isCongested: false };
    }

    // Sample route at intervals and paint surrounding segments
    for (let s = 0; s < totalSegments; s += SAMPLE_STEP) {
        const samplePt = routePath[s]!;

        let playersNear = 0;
        let speedSum = 0;
        let speedCount = 0;

        for (const pt of points) {
            const dx = pt.coordinates[0] - samplePt[0];
            const dy = pt.coordinates[1] - samplePt[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
                playersNear++;
                if (pt.speed !== undefined) {
                    speedSum += pt.speed;
                    speedCount++;
                }
            }
        }

        const avgSpeed = speedCount > 0 ? speedSum / speedCount : undefined;

        // Accumulate gradual delay (continuous, not binary)
        cumulativeDelayMin += sampleDelayMinutes(playersNear, avgSpeed);

        // Determine color for this chunk using count + speed
        const { color, isCongested } = computeTrafficColor(playersNear, avgSpeed);
        if (isCongested) congestedSegmentsCount++;

        totalPlayersOnRoute += playersNear;

        // Paint segments in this sample window
        const end = Math.min(s + SAMPLE_STEP, totalSegments);
        for (let j = s; j < end; j++) {
            routeColors[j] = color as any;
        }
    }

    return {
        averageDensity: totalPlayersOnRoute / Math.max(1, totalSegments),
        totalPlayers: totalPlayersOnRoute,
        congestedSegments: congestedSegmentsCount,
        routeColors,
        trafficDelayMinutes: Math.round(cumulativeDelayMin * 10) / 10, // Round to 1 decimal
    };

}

async function fetchTrafficData(
    bounds: maplibregl.LngLatBounds,
    game: GameType,
    serverId: number,
    geoBox?: { ne: [number, number]; sw: [number, number] },
) {
    if (!serverId) return;

    // Use geoBox override (route bbox) if provided, else use map viewport
    const ne = geoBox ? { lng: geoBox.ne[0], lat: geoBox.ne[1] } : bounds.getNorthEast();
    const sw = geoBox ? { lng: geoBox.sw[0], lat: geoBox.sw[1] } : bounds.getSouthWest();

    let x1: number, y1: number, x2: number, y2: number;

    try {
        if (game === "ets2") {
            const p1 = convertGeoToEts2(ne.lng, ne.lat);
            const p2 = convertGeoToEts2(sw.lng, sw.lat);
            x1 = Math.min(p1[0], p2[0]);
            y1 = Math.max(p1[1], p2[1]); // API expects y1 > y2
            x2 = Math.max(p1[0], p2[0]);
            y2 = Math.min(p1[1], p2[1]); // API expects y1 > y2
        } else {
            const p1 = convertGeoToAts(ne.lng, ne.lat);
            const p2 = convertGeoToAts(sw.lng, sw.lat);
            x1 = Math.min(p1[0], p2[0]);
            y1 = Math.max(p1[1], p2[1]); // API expects y1 > y2
            x2 = Math.max(p1[0], p2[0]);
            y2 = Math.min(p1[1], p2[1]); // API expects y1 > y2
        }
    } catch (e) {
        console.error("[Traffic] Coordinate conversion failed:", e);
        return;
    }

    const margin = 100;
    x1 -= margin;
    y1 += margin; // y1 is larger, so add margin
    x2 += margin;
    y2 -= margin; // y2 is smaller, so subtract margin

    const params = new URLSearchParams({
        x1: String(Math.floor(x1)),
        y1: String(Math.floor(y1)),
        x2: String(Math.floor(x2)),
        y2: String(Math.floor(y2)),
        server: String(serverId),
    });

    const url = `https://tracker.ets2map.com/v3/area?${params.toString()}`;
    console.log(`[Traffic] Fetching: x1=${Math.floor(x1)} y1=${Math.floor(y1)} x2=${Math.floor(x2)} y2=${Math.floor(y2)}`);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error("Traffic proxy returned", res.status);
            return;
        }
        const json = await res.json();
        if (json.error) {
            console.error("Traffic proxy error:", json.error);
            return;
        }
        if (!json.Success || !Array.isArray(json.Data)) {
            console.warn("Traffic API invalid response", json);
            return;
        }

        const players: TrafficPlayer[] = json.Data.map((p: any) => ({
            name: p.Name,
            x: p.X,
            y: p.Y,
            heading: p.Heading,
            mpId: p.MpId,
            playerId: p.PlayerId,
            serverId: p.ServerId,
            speed: undefined // Will be calculated from position history below
        }));

        // Calculate speed from position history (polling every 10s)
        // Uses MpId (permanent TruckersMP ID) as key — more reliable than session-based PlayerId
        const now = Date.now();
        for (const p of players) {
            const prev = playerHistory.get(p.mpId);
            if (prev && now - prev.time < 30000) {
                const dt = (now - prev.time) / 1000; // time delta in seconds
                if (dt > 0.5) {
                    const dist = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
                    const speedKph = estimateSpeedKph(dist / dt);
                    p.speed = speedToScore(speedKph);
                }
            }
            playerHistory.set(p.mpId, { x: p.x, y: p.y, time: now });
        }

        // Clean stale history entries (> 5 min)
        for (const [id, rec] of playerHistory) {
            if (now - rec.time > 300000) playerHistory.delete(id);
        }

        const geoPlayers = players.map((p) => {
            const geo =
                game === "ets2"
                    ? convertEts2ToGeo(p.x, p.y)
                    : convertAtsToGeo(p.x, p.y);
            return { ...p, x: geo[0], y: geo[1] };
        });

        const newPoints = geoPlayers.map(p => ({
            coordinates: [p.x, p.y] as [number, number],
            weight: 1,
            speed: p.speed,
        }));

        // Merge with existing points if fetching route bbox (avoid duplicates by mpId)
        if (geoBox) {
            const existingSet = new Set(trafficPoints.value.map(p => `${p.coordinates[0]},${p.coordinates[1]}`))
            const merged = [...trafficPoints.value];
            for (const pt of newPoints) {
                const key = `${pt.coordinates[0]},${pt.coordinates[1]}`;
                if (!existingSet.has(key)) merged.push(pt);
            }
            trafficPoints.value = merged;
        } else {
            trafficPoints.value = newPoints;
        }
        
        console.log(`[Traffic] Loaded ${newPoints.length} players (total: ${trafficPoints.value.length})`);
    } catch (e) {
        console.error("[Traffic] fetch failed:", e);
    }
}


export function useTrafficData() {
    const { settings, activeSettings } = useSettings();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function setupTrafficLayers(_map: MapLibreGl) {
        // No visual layer — route coloring is handled directly on the route-line source
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function removeTrafficLayers(_map: MapLibreGl) {
        // No layers to remove
    }

    async function refreshTraffic(
        map: MapLibreGl,
        game: GameType,
        routePath?: [number, number][],
    ) {
        if (!trafficEnabled.value) return;
        currentMap = map;
        currentGame = game;

        isTrafficLoading.value = true;

        // Always fetch viewport area for reference data
        const bounds = map.getBounds();
        trafficPoints.value = []; // reset before merging
        const serverId = activeSettings.value.trafficServerId;
        await fetchTrafficData(bounds, game, serverId);

        // If route is active, also fetch its full bounding box for route coloring
        if (routePath && routePath.length > 0) {
            let minLng = Infinity, maxLng = -Infinity;
            let minLat = Infinity, maxLat = -Infinity;
            for (const [lng, lat] of routePath) {
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            }
            const routeGeoBox = {
                ne: [maxLng, maxLat] as [number, number],
                sw: [minLng, minLat] as [number, number],
            };
            // Only fetch route bbox if it's different from viewport
            await fetchTrafficData(bounds, game, serverId, routeGeoBox);

            routeTrafficInfo.value = calculateRouteTrafficInfo(
                trafficPoints.value,
                routePath,
            );
        }

        isTrafficLoading.value = false;
    }

    function startPolling(
        map: MapLibreGl,
        game: GameType,
        routePath?: [number, number][],
    ) {
        if (pollTimer) clearInterval(pollTimer);
        currentMap = map;
        currentGame = game;

        refreshTraffic(map, game, routePath);

        pollTimer = setInterval(() => {
            if (trafficEnabled.value && currentMap) {
                refreshTraffic(currentMap, currentGame, routePath);
            }
        }, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        if (currentMap) {
            removeTrafficLayers(currentMap);
        }
        trafficPoints.value = [];
    }

    function setEnabled(enabled: boolean, map?: MapLibreGl, game?: GameType) {
        trafficEnabled.value = enabled;
        if (enabled && map && game) {
            setupTrafficLayers(map);
            startPolling(map, game);
        } else if (!enabled) {
            stopPolling();
            if (map) {
                removeTrafficLayers(map);
            }
        }
    }

    watch(
        () => settings.value.selectedGame,
        () => {
            if (trafficEnabled.value && currentMap) {
                const game = settings.value.selectedGame || "ets2";
                startPolling(currentMap, game);
            }
        },
    );

    return {
        trafficPoints,
        routeTrafficInfo,
        isTrafficLoading,
        trafficEnabled,
        setupTrafficLayers,
        refreshTraffic,
        startPolling,
        stopPolling,
        setEnabled,
    };
}
