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
}

export interface TrafficPoint {
    coordinates: [number, number];
    weight: number;
}

export interface RouteTrafficInfo {
    averageDensity: number;
    totalPlayers: number;
    congestedSegments: number;
    routeColors: string[]; // Colors for each segment of the route
}



const POLL_INTERVAL = 10000; // 10 seconds

const trafficPoints = ref<TrafficPoint[]>([]);
const routeTrafficInfo = ref<RouteTrafficInfo | null>(null);
const isTrafficLoading = ref(false);
const trafficEnabled = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentMap: MapLibreGl | null = null;
let currentGame: GameType = "ets2";

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

function calculateRouteTrafficInfo(
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

    // Sample route at intervals and paint surrounding segments
    for (let s = 0; s < totalSegments; s += SAMPLE_STEP) {
        const samplePt = routePath[s]!;

        let playersNear = 0;
        for (const pt of points) {
            const dx = pt.coordinates[0] - samplePt[0];
            const dy = pt.coordinates[1] - samplePt[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
                playersNear++;
            }
        }

        // Determine color for this chunk
        let color: string | null = null;
        if (playersNear >= 12) {
            color = "#f44336"; // Red (Heavy)
            congestedSegmentsCount++;
        } else if (playersNear >= 5) {
            color = "#ff9800"; // Orange (Medium)
        } else if (playersNear >= 2) {
            color = "#4caf50"; // Green (Light)
        }

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
        }));

        const geoPlayers = players.map((p) => {
            const geo =
                game === "ets2"
                    ? convertEts2ToGeo(p.x, p.y)
                    : convertAtsToGeo(p.x, p.y);
            return { ...p, x: geo[0], y: geo[1] };
        });

        const newPoints = geoPlayers.map(p => ({
            coordinates: [p.x, p.y] as [number, number],
            weight: 1
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
