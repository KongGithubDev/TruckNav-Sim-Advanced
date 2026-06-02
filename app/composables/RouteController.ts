import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { generateDestinationIcon } from "~/assets/utils/map/markers";
import {
    getBearing,
    getSqDistToSegment,
    DEVIATION_THRESHOLD_SQ,
    getSquaredDist,
} from "~/assets/utils/map/maths";
import { useTrafficData, calculateRouteTrafficInfo, type TrafficPoint } from "~/composables/useTrafficData";
import {
    deleteMapLibreData,
    setMapLibreData,
} from "~/assets/utils/map/helpers";
import {
    generateDirectionsList,
    type DirectionStep,
    type DirectionTranslations,
} from "~/assets/utils/routing/directions";


export const useRouteController = (
    map: Ref<MaplibreMap | null>,
    adjacency: Map<number, any>,
    nodeCoords: Map<number, [number, number]>,
    stopNavigationMode: () => void,
) => {
    const { getGameLocationName, getWorkerCityData } = useCityData();
    const { getClosestNodes } = useGraphSystem();
    const { settings, activeSettings, updateGlobal, updateProfile } =
        useSettings();
    const { t } = useTranslations();

    const currentRoutePath = shallowRef<[number, number][] | null>(null);
    const routeStatsCache = shallowRef<Float32Array | null>(null);

    const destinationName = ref<string>("");
    const routeDistance = ref<number>(0);
    const routeEta = ref<string>("");
    const arrivalTime = ref<string>(""); // e.g. "19:45"

    // Alternative Route
    const altRoutePath = shallowRef<[number, number][] | null>(null);
    const altRouteEta = ref<string>("");
    const altRouteDistance = ref<number>(0);
    const altRouteStats = ref<Float32Array | null>(null);
    const altRouteTrafficDelay = ref<string>("");
    const hasAltRoute = computed(() => altRoutePath.value !== null);
    // Flag: when alt route is faster, display it as primary in the selection card
    const isAltDisplayedAsPrimary = ref(false);

    // Raw data for regenerating directions when alt route is selected/swapped
    const altNodeSequence = ref<number[]>([]);
    const altNodeKms = ref<Float32Array | null>(null);
    const altSequenceManeuvers = ref<Int8Array | null>(null);
    const altSequenceExits = ref<Int8Array | null>(null);
    // Main route raw data (for regenerating directions when swapping back from alt)
    const mainNodeSequence = ref<number[]>([]);
    const mainNodeKms = ref<Float32Array | null>(null);
    const mainSequenceManeuvers = ref<Int8Array | null>(null);
    const mainSequenceExits = ref<Int8Array | null>(null);

    // Last known SDK scale for traffic delay calculations
    const lastSdkScale = ref(19);

    const savedDestination = ref<[number, number] | null>(null);

    const isRouteActive = ref(false);
    const isYardStart = ref(false);

    // Route Selection Mode (choose between main and alt)
    const routeSelectionMode = ref(false);
    const selectionMainDistance = ref(0);
    const selectionMainEta = ref("");
    const selectionMainTrafficDelay = ref("");
    const selectionAltDistance = ref(0);
    const selectionAltEta = ref("");
    const selectionAltTrafficDelay = ref("");
    const selectionTimeDiff = ref({ minutes: 0, fasterLabel: "" }); // positive = alt slower, negative = alt faster

    const isTruckInYard = ref(false);

    const startNodeId = ref<number | null>(null);
    const endNodeId = ref<number | null>(null);
    const lastMathPos = ref<[number, number] | null>(null);

    const isCalculating = ref(false);
    const isRerouting = ref(false);
    const routeFound = ref<boolean | null>(null);

    const currentRouteIndex = ref(0);
    /** Smooth float index for visually animating the route line split point */
    const visualProgress = ref(0);
    let lastDrawnVisualIndex = -1;
    const isWorkerReady = ref(false);

    /** Route line opacity for fade transitions during reroute */
    const routeOpacity = ref(1);
    const altRouteOpacity = ref(0.7);
    let routeAnimFrame: number | null = null;
    let progressPulseFrame: number | null = null;

    const fullRouteDirections = ref<DirectionStep[]>([]);
    const nextTurnDistance = ref<number>(0);

    watch(
        () => activeSettings.value.themeColor,
        async (newColor) => {
            if (map.value && map.value.hasImage("destination-icon")) {
                const newPinImg = await generateDestinationIcon(newColor);
                map.value.updateImage("destination-icon", newPinImg);
            }
        },
    );

    watch(
        () => activeSettings.value.routeColor,
        (newColor) => {
            if (map.value && map.value.getLayer("route-line")) {
                map.value.setPaintProperty(
                    "route-line",
                    "line-color",
                    newColor,
                );
            }
            // Also update progress marker colors to match
            if (map.value && map.value.getLayer("route-progress-glow")) {
                map.value.setPaintProperty("route-progress-glow", "circle-color", newColor);
            }
            if (map.value && map.value.getLayer("route-progress-dot")) {
                map.value.setPaintProperty("route-progress-dot", "circle-color", newColor);
            }
        },
    );

    // Animate route and passed-line opacity for smooth fade transitions
    watch(routeOpacity, (opacity) => {
        if (!map.value) return;
        if (map.value.getLayer("route-line")) {
            map.value.setPaintProperty("route-line", "line-opacity", opacity);
        }
        if (map.value.getLayer("route-passed-line")) {
            map.value.setPaintProperty("route-passed-line", "line-opacity", opacity);
        }
        // Also fade the progress marker with the route
        if (map.value.getLayer("route-progress-glow")) {
            map.value.setPaintProperty("route-progress-glow", "circle-opacity", opacity * 0.3);
        }
        if (map.value.getLayer("route-progress-dot")) {
            map.value.setPaintProperty("route-progress-dot", "circle-opacity", opacity);
        }
    });

    // Animate alt route line opacity
    watch(altRouteOpacity, (opacity) => {
        if (!map.value) return;
        if (map.value.getLayer("alt-route-line")) {
            map.value.setPaintProperty("alt-route-line", "line-opacity", opacity);
        }
        // Also fade the alt progress marker with the alt route
        if (map.value.getLayer("alt-route-progress-glow")) {
            map.value.setPaintProperty("alt-route-progress-glow", "circle-opacity", opacity * 0.2);
        }
        if (map.value.getLayer("alt-route-progress-dot")) {
            map.value.setPaintProperty("alt-route-progress-dot", "circle-opacity", opacity * 0.6);
        }
    });

    watch(
        () => activeSettings.value.hasTurnNavigation,
        (hasGuidedNavigation) => {
            if (!map.value) return;

            if (hasGuidedNavigation) {
                if (isRouteActive.value && currentRoutePath.value) {
                    drawTurnArrows(
                        fullRouteDirections.value,
                        currentRoutePath.value,
                    );
                }
            } else {
                const lineSource = map.value.getSource(
                    "turn-arrows-line-source",
                ) as GeoJSONSource;
                const headSource = map.value.getSource(
                    "turn-arrows-head-source",
                ) as GeoJSONSource;

                const emptyData: any = {
                    type: "FeatureCollection",
                    features: [],
                };

                if (lineSource) lineSource.setData(emptyData);
                if (headSource) headSource.setData(emptyData);
            }
        },
    );

    let worker: Worker | null = null;
    if (import.meta.client) {
        worker = new Worker(
            new URL("~/workers/route.worker.ts", import.meta.url),
            { type: "module" },
        );

        worker.onmessage = (e) => {
            if (e.data.type === "READY") {
                console.log("Web Worker Ready.");
                isWorkerReady.value = true;
            }
        };
    }

    function destroyWorker() {
        if (worker) {
            worker.terminate();
            worker = null;
        }
    }

    function initWorkerData(
        nodesArray: any[],
        graphBuffer: ArrayBuffer | null,
        geometryBuffer: ArrayBuffer | null,
    ) {
        if (!worker) return;
        const cityPayload = getWorkerCityData();

        worker.postMessage({
            type: "INIT_GRAPH",
            payload: {
                nodes: nodesArray,
                graphBuffer: graphBuffer,
                geometryBuffer: geometryBuffer,
                cities: cityPayload,
            },
        });

    }

    function projectPointToSegment(
        p: [number, number],
        v: [number, number],
        w: [number, number],
    ): [number, number] {
        const l2 = getSquaredDist(v, w);
        if (l2 === 0) return [v[0], v[1]];
        let t =
            ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) /
            l2;
        t = Math.max(0, Math.min(1, t));
        return [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
    }

    function drawTurnArrows(
        steps: DirectionStep[],
        displayPath: [number, number][],
    ) {
        if (!map.value) return;

        const linesFeatures = [];
        const headsFeatures = [];

        const ARROW_HEAD_OFFSET_M = 30;

        const MAX_ARROWS_TO_SHOW = 2;
        let arrowsDrawn = 0;

        for (const step of steps) {
            if (
                ["depart", "destination", "straight", "ferry"].includes(
                    step.type,
                )
            )
                continue;

            if (arrowsDrawn >= MAX_ARROWS_TO_SHOW) break;

            let startIdx = -1;
            let minStartDist = Infinity;
            for (let i = 0; i < displayPath.length; i++) {
                const distSq = getSquaredDist(displayPath[i]!, step.coords);
                if (distSq < minStartDist) {
                    minStartDist = distSq;
                    startIdx = i;
                }
            }

            let endIdx = startIdx;
            if (step.exitCoords && startIdx !== -1) {
                let minEndDist = Infinity;
                const searchLimit = Math.min(
                    displayPath.length,
                    startIdx + 1000,
                );
                for (let i = startIdx; i < searchLimit; i++) {
                    const distSq = getSquaredDist(
                        displayPath[i]!,
                        step.exitCoords,
                    );
                    if (distSq < minEndDist) {
                        minEndDist = distSq;
                        endIdx = i;
                    }
                }
            }

            if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
                const arrowCoords: [number, number][] = [];

                for (let i = startIdx; i <= endIdx; i++) {
                    arrowCoords.push(displayPath[i]!);
                }

                let hIdx = endIdx;
                let dFwd = 0;
                let finalHeadPoint: [number, number] = displayPath[hIdx]!;

                while (
                    hIdx < displayPath.length - 1 &&
                    dFwd < ARROW_HEAD_OFFSET_M
                ) {
                    const segDist =
                        Math.sqrt(
                            getSquaredDist(
                                displayPath[hIdx]!,
                                displayPath[hIdx + 1]!,
                            ),
                        ) * 111000;
                    if (dFwd + segDist > ARROW_HEAD_OFFSET_M) {
                        const ratio = (ARROW_HEAD_OFFSET_M - dFwd) / segDist;
                        const p1 = displayPath[hIdx]!;
                        const p2 = displayPath[hIdx + 1]!;
                        finalHeadPoint = [
                            p1[0] + (p2[0] - p1[0]) * ratio,
                            p1[1] + (p2[1] - p1[1]) * ratio,
                        ];
                        dFwd = ARROW_HEAD_OFFSET_M;
                    } else {
                        dFwd += segDist;
                        hIdx++;
                        finalHeadPoint = displayPath[hIdx]!;
                    }
                }

                if (dFwd > 0) {
                    arrowCoords.push(finalHeadPoint);
                }

                // 5. Generate MapLibre features
                if (arrowCoords.length >= 2) {
                    linesFeatures.push({
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: arrowCoords,
                        },
                        properties: {},
                    });

                    const pLast = arrowCoords[arrowCoords.length - 1]!;
                    const pPrev = arrowCoords[arrowCoords.length - 2]!;
                    const bearing = getBearing(pPrev, pLast);

                    headsFeatures.push({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: pLast },
                        properties: { bearing },
                    });

                    // --- NEW: Register that we successfully drew an arrow ---
                    arrowsDrawn++;
                }
            }
        }

        const lineSource = map.value.getSource(
            "turn-arrows-line-source",
        ) as GeoJSONSource;
        const headSource = map.value.getSource(
            "turn-arrows-head-source",
        ) as GeoJSONSource;

        if (lineSource)
            lineSource.setData({
                type: "FeatureCollection",
                features: linesFeatures as any,
            });
        if (headSource)
            headSource.setData({
                type: "FeatureCollection",
                features: headsFeatures as any,
            });
    }

    function calculateRouteInWorker(
        startId: number,
        possibleEnds: number[],
        heading: number,
        startType: string,
        targetCoords: [number, number],
        projectedStartCoords: [number, number],
        ownedDlcs: number[],
        sdkScale: number,
        avgSpeed: number,
        trafficPoints?: [number, number][],
    ): Promise<any> {
        return new Promise((resolve) => {
            if (!worker) {
                resolve(null);
                return;
            }

            const handler = (e: MessageEvent) => {
                if (e.data.type === "RESULT") {
                    worker!.removeEventListener("message", handler);
                    resolve(e.data.payload);
                }
            };

            worker.addEventListener("message", handler);

            worker.postMessage({
                type: "CALC_ROUTE",
                payload: {
                    startId,
                    possibleEnds,
                    heading,
                    startType,
                    targetCoords,
                    projectedStartCoords,
                    ownedDlcs,
                    selectedGame: settings.value.selectedGame,
                    sdkScale,
                    avgSpeed,
                    trafficPoints: trafficPoints || undefined,
                },
            });
        });
    }

    function findBestStartConfiguration(
        truckCoords: [number, number],
        truckHeading: number,
        searchLimit: number = 50,
    ) {
        if (adjacency.size === 0 || nodeCoords.size === 0) {
            console.error("CRITICAL: Graph data is empty!");
            return null;
        }

        const nearbyNodes = getClosestNodes(truckCoords, searchLimit, 0.1);

        if (nearbyNodes.length === 0) {
            return null;
        }

        let bestEdge = null;
        let minScore = Infinity;

        for (const fromNodeId of nearbyNodes) {
            const neighbors = adjacency.get(fromNodeId);
            const fromPos = nodeCoords.get(fromNodeId);
            if (!neighbors || !fromPos) continue;

            for (const edge of neighbors) {
                const toPos = nodeCoords.get(edge.to);
                if (!toPos) continue;

                let roadBearing = getBearing(fromPos, toPos);

                let diff = Math.abs(truckHeading - roadBearing);
                if (diff > 180) diff = 360 - diff;

                const isOpposite = diff > 90;
                const trueDiff = isOpposite ? 180 - diff : diff;
                if (trueDiff > 45) continue;

                const visualRoadBearing = isOpposite
                    ? (roadBearing + 180) % 360
                    : roadBearing;

                const projected = projectPointToSegment(
                    truckCoords,
                    fromPos,
                    toPos,
                );
                const distSq = getSquaredDist(truckCoords, projected);
                const distKm = Math.sqrt(distSq) * 111;

                const headingPenalty = Math.pow(trueDiff / 90, 2) * 0.1;
                const directionPenalty = isOpposite ? 0.5 : 0;

                const score = distKm + headingPenalty + directionPenalty;

                if (score < minScore) {
                    minScore = score;
                    bestEdge = {
                        type: "road",
                        fromId: fromNodeId,
                        toId: edge.to,
                        projectedCoords: projected,
                        bearing: visualRoadBearing,
                    };
                }
            }
        }

        if (bestEdge) return bestEdge;

        const yardCandidates = getClosestNodes(truckCoords, 10, 0.3);
        let closestNodeId: number | null = null;
        let minNodeDist = Infinity;

        for (const nodeId of yardCandidates) {
            const nodePos = nodeCoords.get(nodeId);
            if (!nodePos) continue;

            const distSq = getSquaredDist(truckCoords, nodePos);
            if (distSq < minNodeDist) {
                minNodeDist = distSq;
                closestNodeId = nodeId;
            }
        }

        if (closestNodeId !== null) {
            const nodePos = nodeCoords.get(closestNodeId);
            if (!nodePos) return;

            return {
                type: "yard",
                fromId: closestNodeId,
                toId: closestNodeId,
                projectedCoords: nodePos,
            };
        }

        return null;
    }

    function startProgressPulse() {
        if (progressPulseFrame !== null) return; // Already running

        function frame(now: number) {
            if (!map.value || !map.value.getLayer("route-progress-glow")) {
                stopProgressPulse();
                return;
            }

            // Calculate base radius at current zoom (lerp 14→18 between zoom 10→12)
            const zoom = map.value.getZoom();
            const t = Math.max(0, Math.min((zoom - 10) / 2, 1));
            const baseRadius = 14 + (18 - 14) * t;

            // Sine oscillation: ~1.5 Hz, amplitude ±3px
            const pulse = Math.sin(now * 0.003 * Math.PI); // period ≈ 667ms
            const radius = baseRadius + pulse * 3;

            map.value.setPaintProperty("route-progress-glow", "circle-radius", radius);
            progressPulseFrame = requestAnimationFrame(frame);
        }

        progressPulseFrame = requestAnimationFrame(frame);
    }

    function stopProgressPulse() {
        if (progressPulseFrame !== null) {
            cancelAnimationFrame(progressPulseFrame);
            progressPulseFrame = null;
        }
    }

    function animateRouteOpacity(target: number, duration: number = 300): Promise<void> {
        return new Promise((resolve) => {
            if (routeAnimFrame !== null) {
                cancelAnimationFrame(routeAnimFrame);
                routeAnimFrame = null;
            }

            const start = performance.now();
            const startOpacity = routeOpacity.value;

            function frame(now: number) {
                const elapsed = now - start;
                const t = Math.min(elapsed / duration, 1);
                // Cubic ease-out
                const eased = 1 - Math.pow(1 - t, 3);
                routeOpacity.value = startOpacity + (target - startOpacity) * eased;

                if (t < 1) {
                    routeAnimFrame = requestAnimationFrame(frame);
                } else {
                    routeOpacity.value = target;
                    routeAnimFrame = null;
                    resolve();
                }
            }

            routeAnimFrame = requestAnimationFrame(frame);
        });
    }

    async function findFlexibleRoute(
        startNodeId: number,
        targetCoords: [number, number],
        truckHeading: number,
        startType: "road" | "yard",
        projectedStartCoords: [number, number],
        sdkScale: number,
        avgSpeed: number,
        trafficPoints?: [number, number][],
    ) {
        const SEARCH_RADII = [1, 2, 4, 8, 16, 32, 100, 300];
        const userDlcs = toRaw(activeSettings.value.ownedDlcs);

        for (const radius of SEARCH_RADII) {
            const candidates = getClosestNodes(targetCoords, radius, 0.1);

            if (candidates.length === 0) continue;

            const result = await calculateRouteInWorker(
                startNodeId,
                candidates,
                truckHeading,
                startType,
                targetCoords,
                projectedStartCoords,
                userDlcs,
                sdkScale,
                avgSpeed,
                trafficPoints,
            );

            // Worker returns { main, alternative } - check that main route exists
            const mainRoute = result?.main ?? result;
            if (mainRoute && mainRoute.displayPath) {
                return result;
            }
        }

        return null;
    }

    function drawRouteOnMap(coords: [number, number][]) {
        if (!map.value) return;

        const rawMap = toRaw(map.value);
        setMapLibreData(rawMap, "route-line", "LineString", toRaw(coords));
    }

    function redrawRouteWithTraffic(colors: string[] | null) {
        if (!map.value || !currentRoutePath.value) return;
        const coords = toRaw(currentRoutePath.value);
        const rawMap = toRaw(map.value);
        
        if (!colors || colors.length !== coords.length - 1) {
            setMapLibreData(rawMap, "route-line", "LineString", coords);
            return;
        }

        const features = [];
        for (let i = 0; i < coords.length - 1; i++) {
            const props: any = {};
            if (colors[i]) props.color = colors[i];
            
            features.push({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [coords[i], coords[i + 1]]
                },
                properties: props
            });
        }
        
        const source = map.value.getSource("route-line") as GeoJSONSource;
        if (source) {
            source.setData({
                type: "FeatureCollection",
                features: features as any
            });
        }
    }

    function drawAltRouteOnMap(
        coords: [number, number][],
        trafficColors?: (string | null)[] | null,
    ) {
        if (!map.value) return;
        const rawMap = toRaw(map.value);

        if (!trafficColors || trafficColors.length !== coords.length - 1) {
            // No traffic colors — draw as simple single line
            setMapLibreData(rawMap, "alt-route-line", "LineString", toRaw(coords));
            return;
        }

        // Draw as per-segment features with individual traffic colors
        const features = [];
        for (let i = 0; i < coords.length - 1; i++) {
            const props: any = {};
            if (trafficColors[i]) props.color = trafficColors[i];
            features.push({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [coords[i], coords[i + 1]],
                },
                properties: props,
            });
        }

        const source = rawMap.getSource("alt-route-line") as GeoJSONSource;
        if (source) {
            source.setData({
                type: "FeatureCollection",
                features: features as any,
            });
        }
    }

    function addDestinationMarker(coords: [number, number]) {
        if (!map.value) return;
        setMapLibreData(map.value, "destination-source", "Point", coords);
    }

    async function setupRouteLayer() {
        if (!map.value) return;
        if (map.value.getSource("route-line")) return;

        if (!map.value.hasImage("destination-icon")) {
            const pinImg = await generateDestinationIcon(
                activeSettings.value.themeColor,
            );
            map.value.addImage("destination-icon", pinImg, { pixelRatio: 2.5 });
        }

        // Alt route layer (drawn first so it's behind) — supports per-segment traffic colors
        map.value.addSource("alt-route-line", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
        map.value.addLayer({
            id: "alt-route-line",
            type: "line",
            source: "alt-route-line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": ["coalesce", ["get", "color"], "#6b7a8d"],
                "line-width": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 5, 11.5, 7,
                ],
                "line-opacity": 0.7,
                "line-dasharray": [2, 2],
            },
        }, "all-sprites");

        map.value.addSource("route-line", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
        
        map.value.addSource("route-passed-line", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });

        map.value.addLayer(
            {
                id: "route-passed-line",
                type: "line",
                source: "route-passed-line",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": "#5a6a7c",
                    "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        8,
                        10.2,
                        9,
                        10.5,
                        6,
                        11.5,
                        11,
                    ],
                },
            },
            "all-sprites",
        );

        map.value.addLayer(
            {
                id: "route-line",
                type: "line",
                source: "route-line",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": ["coalesce", ["get", "color"], activeSettings.value.routeColor],
                    "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        8,
                        10.2,
                        9,
                        10.5,
                        6,
                        11.5,
                        11,
                    ],
                },
            },
            "all-sprites",
        );

        // Progress marker — a glowing dot that moves along the route path
        map.value.addSource("route-progress-marker", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
        
        // Outer glow layer
        map.value.addLayer({
            id: "route-progress-glow",
            type: "circle",
            source: "route-progress-marker",
            paint: {
                "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 14, 12, 18,
                ],
                "circle-color": activeSettings.value.routeColor,
                "circle-opacity": 0.25,
                "circle-blur": 2,
            },
        });
        
        // Inner solid dot with white stroke
        map.value.addLayer({
            id: "route-progress-dot",
            type: "circle",
            source: "route-progress-marker",
            paint: {
                "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 6, 12, 8,
                ],
                "circle-color": activeSettings.value.routeColor,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 2, 12, 3,
                ],
                "circle-opacity": 1,
            },
        });

        // Alt route progress marker — a smaller grey dot showing proportional position on alt route
        map.value.addSource("alt-route-progress-marker", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
        
        // Alt route glow
        map.value.addLayer({
            id: "alt-route-progress-glow",
            type: "circle",
            source: "alt-route-progress-marker",
            paint: {
                "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 10, 12, 13,
                ],
                "circle-color": "#6b7a8d",
                "circle-opacity": 0.2,
                "circle-blur": 1.5,
            },
        });
        
        // Alt route solid dot (smaller, no white stroke, semi-transparent)
        map.value.addLayer({
            id: "alt-route-progress-dot",
            type: "circle",
            source: "alt-route-progress-marker",
            paint: {
                "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 4, 12, 5.5,
                ],
                "circle-color": "#6b7a8d",
                "circle-opacity": 0.6,
            },
        });

        if (!map.value.getSource("destination-source")) {
            map.value.addSource("destination-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.value.addLayer({
                id: "destination-layer",
                type: "symbol",
                source: "destination-source",
                layout: {
                    "icon-image": "destination-icon",
                    "icon-anchor": "bottom",
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                },
            });

            map.value.on("click", "destination-layer", () => {
                clearRouteState();
            });
            map.value.on("mouseenter", "destination-layer", () => {
                map.value!.getCanvas().style.cursor = "pointer";
            });
            map.value.on("mouseleave", "destination-layer", () => {
                map.value!.getCanvas().style.cursor = "";
            });
        }

        if (!map.value.hasImage("turn-arrow-icon")) {
            const arrowImg = new Image();
            arrowImg.onload = () =>
                map.value!.addImage("turn-arrow-icon", arrowImg);

            arrowImg.src =
                "data:image/svg+xml;charset=utf-8," +
                encodeURIComponent(
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 20L12 16L22 20L12 2Z" fill="white" stroke="#1c1c1c" stroke-width="2" stroke-linejoin="round"/></svg>',
                );
        }

        if (!map.value.getSource("turn-arrows-line-source")) {
            map.value.addSource("turn-arrows-line-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.value.addLayer({
                id: "turn-arrows-line-border",
                type: "line",
                source: "turn-arrows-line-source",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": "#1c1c1c",
                    "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        9,
                        15,
                        15,
                    ],
                },
            });

            map.value.addLayer({
                id: "turn-arrows-line-inner",
                type: "line",
                source: "turn-arrows-line-source",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": "#ffffff",
                    "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        5.5,
                        15,
                        9.5,
                    ],
                },
            });
        }

        if (!map.value.getSource("turn-arrows-head-source")) {
            map.value.addSource("turn-arrows-head-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.value.addLayer({
                id: "turn-arrows-head-layer",
                type: "symbol",
                source: "turn-arrows-head-source",
                layout: {
                    "icon-image": "turn-arrow-icon",
                    "icon-size": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        0.83,
                        15,
                        1.33,
                    ],
                    "icon-rotation-alignment": "map",
                    "icon-rotate": ["get", "bearing"],
                    "icon-anchor": "center",
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                },
            });
        }
    }

    async function handleRouteClick(
        clickCoords: [number, number],
        truckCoords: [number, number],
        truckHeading: number,
        sdkScale: number,
        createEndMarker: boolean,
        avgSpeed: number,
        skipSelectionMode: boolean = false,
    ) {
        if (adjacency.size === 0 || isCalculating.value || !isWorkerReady.value)
            return;
        // Don't calculate a new route while in selection mode
        if (routeSelectionMode.value) return;

        isCalculating.value = true;
        routeFound.value = null;

        savedDestination.value = clickCoords;

        try {
            const startConfig = findBestStartConfiguration(
                truckCoords,
                truckHeading,
                50,
            );

            if (!startConfig) {
                routeFound.value = false;
                return;
            }
            isYardStart.value = startConfig.type === "yard";

            // Gather traffic points (in geo coords) for traffic-aware routing of alt route
            // The A* algorithm uses geo coordinates internally, so pass them directly
            // Must use toRaw() because Vue reactive Proxy can't be cloned via postMessage
            const { trafficPoints } = useTrafficData();
            const rawPoints = toRaw(trafficPoints.value) || [];
            const trafficCoords: [number, number][] = rawPoints.map(pt => [pt.coordinates[0], pt.coordinates[1]] as [number, number]);

            startNodeId.value = startConfig.toId;
            const result = await findFlexibleRoute(
                startNodeId.value!,
                toRaw(clickCoords),
                truckHeading,
                startConfig.type as "road" | "yard",
                startConfig.projectedCoords,
                sdkScale,
                avgSpeed,
                trafficCoords,
            );

            // Check if route was cancelled while we were calculating
            // clearRouteState sets savedDestination to null, which serves as a cancellation flag
            if (!savedDestination.value) {
                return;
            }

            // Worker returns { main, alternative } - extract main route
            const mainResult = result?.main ?? result;

            if (mainResult) {
                lastSdkScale.value = sdkScale;
                endNodeId.value = mainResult.endId;

                const frozenRawPath = Object.freeze(mainResult.displayPath);
                currentRoutePath.value = frozenRawPath as any;

                routeStatsCache.value = mainResult.stats;

                const cache = mainResult.stats;
                const lastIdx = (mainResult.rawPath.length - 1) * 2;
                const totalKm = cache[lastIdx]!;
                const totalRealHours = cache[lastIdx + 1]!;

                drawRouteOnMap(mainResult.displayPath);
                if (createEndMarker) addDestinationMarker(clickCoords);

                routeDistance.value = Math.round(totalKm);
                // Add Traffic Delay (convert in-game delay to real-world using current scale)
                const { routeTrafficInfo } = useTrafficData();
                const trafficDelayMinutes = routeTrafficInfo.value?.trafficDelayMinutes || 0;
                const trafficDelayInGameHours = trafficDelayMinutes / 60;
                const trafficDelayRealHours = trafficDelayInGameHours / sdkScale;
                const finalRealHours = totalRealHours + trafficDelayRealHours;

                const h = Math.floor(finalRealHours);
                const m = Math.round((finalRealHours - h) * 60);
                
                let trafficDelayStr = "";
                if (trafficDelayRealHours > 0) {
                    trafficDelayStr = ` (+${Math.round(trafficDelayRealHours * 60)}m traffic)`;
                }
                
                routeEta.value = `${h}h ${m}min${trafficDelayStr}`;

                // Compute real-world arrival clock time
                const now = new Date();
                const arrivalDate = new Date(now.getTime() + finalRealHours * 3600000);
                arrivalTime.value = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                destinationName.value = getGameLocationName(
                    clickCoords[0],
                    clickCoords[1],
                );

                // Store main route raw data for potential directions regeneration
                mainNodeSequence.value = mainResult.nodeSequence;
                mainNodeKms.value = mainResult.nodeKms;
                mainSequenceManeuvers.value = mainResult.sequenceManeuvers;
                mainSequenceExits.value = mainResult.sequenceExits;

                fullRouteDirections.value = generateDirectionsList(
                    mainResult.nodeSequence,
                    mainResult.nodeKms,
                    mainResult.sequenceManeuvers,
                    mainResult.sequenceExits,
                    nodeCoords,
                    {
                        headOnRoute: t('directions.headOnRoute'),
                        turnLeft: t('directions.turnLeft'),
                        turnRight: t('directions.turnRight'),
                        keepLeft: t('directions.keepLeft'),
                        keepRight: t('directions.keepRight'),
                        takeExit: t('directions.takeExit'),
                        exitAtRoundabout: t('directions.exitAtRoundabout'),
                        roundaboutExit: (exitCount: number, suffix: string) =>
                            t('directions.roundaboutExit')
                                .replace('{number}', String(exitCount))
                                .replace('{suffix}', suffix),
                        arrived: t('directions.arrived'),
                    },
                );

                if (fullRouteDirections.value.length > 1) {
                    const upcomingTurn = fullRouteDirections.value[1];
                    if (
                        upcomingTurn &&
                        upcomingTurn.cumulativeKm !== undefined
                    ) {
                        const distKm = +upcomingTurn.cumulativeKm.toFixed(1);
                        nextTurnDistance.value = Math.max(0, distKm);
                    }
                } else {
                    nextTurnDistance.value = 0;
                }

                currentRouteIndex.value = 0;
                visualProgress.value = 0;
                lastDrawnVisualIndex = -1;
                lastRecalcTime.value = Date.now(); // Prevent immediate deviation retrigger
                updateProfile("lastDestination", savedDestination.value);

                // Use the alternative route already computed by the worker (edge-exclusion method)
                altRoutePath.value = null;
                altRouteEta.value = "";
                altRouteDistance.value = 0;
                altRouteStats.value = null;

                const altData = result?.alternative;
                const hasMeaningfulAlt = altData && altData.displayPath && altData.stats && (() => {
                    const altLastIdx = (altData.rawPath.length - 1) * 2;
                    const altKm: number = altData.stats[altLastIdx] ?? 0;
                    const primaryKm = routeDistance.value;
                    const kmDiff = Math.abs(altKm - primaryKm);
                    const pctDiff = primaryKm > 0 ? kmDiff / primaryKm : 0;
                    return kmDiff > 5 || pctDiff > 0.1;
                })();

                if (hasMeaningfulAlt) {
                    // Store alt route data
                    const altLastIdx = (altData.rawPath.length - 1) * 2;
                    const altKm: number = altData.stats[altLastIdx] ?? 0;
                    const altRealHours: number = altData.stats[altLastIdx + 1] ?? 0;

                    altRoutePath.value = altData.displayPath;
                    altRouteDistance.value = Math.round(altKm);
                    altRouteStats.value = altData.stats;
                    altNodeSequence.value = altData.nodeSequence;
                    altNodeKms.value = altData.nodeKms;
                    altSequenceManeuvers.value = altData.sequenceManeuvers;
                    altSequenceExits.value = altData.sequenceExits;

                    // Compute traffic info for alt route: both visualization colors and delay estimate
                    const { trafficPoints } = useTrafficData();
                    const tp = trafficPoints.value || [];
                    const altTrafficInfo = altData.displayPath ? calculateRouteTrafficInfo(tp, altData.displayPath) : null;
                    
                    // Draw alt route with traffic congestion colors
                    drawAltRouteOnMap(altData.displayPath, altTrafficInfo?.routeColors);

                    // Alt route traffic delay (in real-world minutes) — uses granular weighted sum
                    const altDelayMin = altTrafficInfo ? Math.round(altTrafficInfo.trafficDelayMinutes / sdkScale) : 0;
                    selectionAltTrafficDelay.value = altDelayMin > 0 ? `+${altDelayMin}m` : "";
                    altRouteTrafficDelay.value = altDelayMin > 0 ? `+${altDelayMin}m` : "";

                    // Alt route ETA with traffic (consistent with routeEta format)
                    const altTotalRealHours = altRealHours + (altDelayMin / 60);
                    const aH = Math.floor(altTotalRealHours);
                    const aM = Math.round((altTotalRealHours - aH) * 60);
                    let altTrafficStr = "";
                    if (altDelayMin > 0) {
                        altTrafficStr = ` (+${altDelayMin}m traffic)`;
                    }
                    altRouteEta.value = `${aH}h ${aM}min${altTrafficStr}`;

                    // Main route traffic delay (from existing polling data) — uses granular weighted sum
                    const mainTrafficInfo = routeTrafficInfo.value;
                    const mainDelayMin = mainTrafficInfo ? Math.round(mainTrafficInfo.trafficDelayMinutes / sdkScale) : 0;
                    selectionMainTrafficDelay.value = mainDelayMin > 0 ? `+${mainDelayMin}m` : "";

                    // Compute time difference for the comparison badge
                    const mainTotalMin = totalRealHours * 60 + mainDelayMin;
                    const altTotalMin = altRealHours * 60 + altDelayMin;
                    const diffMin = Math.round(altTotalMin - mainTotalMin);
                    if (Math.abs(diffMin) >= 1) {
                        selectionTimeDiff.value = {
                            minutes: Math.abs(diffMin),
                            fasterLabel: diffMin < 0 ? 'alt' : 'main',
                        };
                    } else {
                        selectionTimeDiff.value = { minutes: 0, fasterLabel: '' };
                    }

                    // Store selection info for UI
                    selectionMainDistance.value = routeDistance.value;
                    // Use base ETA without traffic for selection card (traffic shown as badge separately)
                    const mainBaseH = Math.floor(totalRealHours);
                    const mainBaseM = Math.round((totalRealHours - mainBaseH) * 60);
                    selectionMainEta.value = `${mainBaseH}h ${mainBaseM}min`;
                    selectionAltDistance.value = altRouteDistance.value;
                    // Use base ETA without traffic for alt selection card (badge shows traffic separately)
                    const altBaseH = Math.floor(altRealHours);
                    const altBaseM = Math.round((altRealHours - altBaseH) * 60);
                    selectionAltEta.value = `${altBaseH}h ${altBaseM}min`;

                    // If alt route is faster (including traffic), swap display so faster shows first
                    isAltDisplayedAsPrimary.value = false;
                    if (selectionTimeDiff.value.fasterLabel === 'alt') {
                        // Swap display values so the faster route (alt) is shown as primary
                        const tmpDist = selectionMainDistance.value;
                        const tmpEta = selectionMainEta.value;
                        const tmpDelay = selectionMainTrafficDelay.value;
                        selectionMainDistance.value = selectionAltDistance.value;
                        selectionMainEta.value = selectionAltEta.value;
                        selectionMainTrafficDelay.value = selectionAltTrafficDelay.value;
                        selectionAltDistance.value = tmpDist;
                        selectionAltEta.value = tmpEta;
                        selectionAltTrafficDelay.value = tmpDelay;
                        isAltDisplayedAsPrimary.value = true;
                        // Also swap the faster label so primary always shows "faster" badge
                        selectionTimeDiff.value = {
                            minutes: selectionTimeDiff.value.minutes,
                            fasterLabel: 'main',
                        };
                    }

                    // During rerouting, auto-select main route without showing selection card
                    if (skipSelectionMode) {
                        isRouteActive.value = true;
                        routeFound.value = true;
                        startProgressPulse();
                        if (activeSettings.value.hasTurnNavigation) {
                            drawTurnArrows(
                                fullRouteDirections.value,
                                mainResult.displayPath,
                            );
                        }
                    } else {
                        // Show route selection card instead of activating immediately
                        routeSelectionMode.value = true;
                        routeFound.value = null; // Don't show notification yet
                        // isRouteActive stays false - sheet won't appear yet
                    }
                } else {
                    // No meaningful alternative - activate main route immediately
                    isRouteActive.value = true;
                    routeFound.value = true;
                    // Start the progress glow pulse animation
                    startProgressPulse();

                    if (activeSettings.value.hasTurnNavigation) {
                        drawTurnArrows(
                            fullRouteDirections.value,
                            mainResult.displayPath,
                        );
                    }
                }
            } else {
                routeFound.value = false;
            }
        } catch (e) {
            console.log(`Route calculation Failed: ${e}`);
            isRouteActive.value = false;
        } finally {
            isCalculating.value = false;
        }
    }

    const lastRecalcTime = ref(0);
    const updateRouteProgress = (
        truckCoords: [number, number],
        truckHeading: number,
        sdkScale: number,
        avgSpeed: number,
    ) => {
        if (!currentRoutePath.value || currentRoutePath.value.length < 2)
            return;
        const cache = routeStatsCache.value;
        if (!cache) return;

        if (lastMathPos.value) {
            const sqDist = getSquaredDist(lastMathPos.value, truckCoords);
            if (sqDist < 0.000000001) return;
        }
        lastMathPos.value = truckCoords;

        const path = currentRoutePath.value;
        let bestIndex = currentRouteIndex.value;
        let minSqDist = Infinity;

        const searchLimit = Math.min(path.length - 1, bestIndex + 500);
        const startSearch = Math.max(0, bestIndex - 5);

        for (let i = startSearch; i < searchLimit; i++) {
            const distSq = getSqDistToSegment(
                truckCoords,
                path[i]!,
                path[i + 1]!,
            );

            if (distSq < minSqDist) {
                minSqDist = distSq;
                bestIndex = i;
            }
        }

        // Monotonic progress: only move forward (prevents oscillation jitter)
        if (bestIndex > currentRouteIndex.value) {
            currentRouteIndex.value = bestIndex;
        } else if (bestIndex < currentRouteIndex.value - 5) {
            // Allow large backward jumps (reroute from different path point)
            currentRouteIndex.value = bestIndex;
        }

        // Smooth visual progress using exponential moving average
        // This creates a smooth creeping effect between path points
        if (visualProgress.value === 0 && currentRouteIndex.value > 0) {
            // Initialize visual progress to current index on first meaningful update
            visualProgress.value = currentRouteIndex.value;
        } else {
            visualProgress.value += (currentRouteIndex.value - visualProgress.value) * 0.35;
        }

        let activeThreshold = DEVIATION_THRESHOLD_SQ;

        const distToEndSq = getSquaredDist(truckCoords, path[path.length - 1]!);
        if (distToEndSq < 0.00005) {
            clearRouteState();
            return;
        }

        const lastIdx = (path.length - 1) * 2;
        const currentIdx = bestIndex * 2;

        const totalKm = cache[lastIdx]!;
        const totalRealHours = cache[lastIdx + 1]!;

        const currentKm = cache[currentIdx]!;
        const currentRealHours = cache[currentIdx + 1]!;

        const remKm = totalKm - currentKm;
        const remRealHours = totalRealHours - currentRealHours;                routeDistance.value = Math.round(remKm);

                if (remRealHours > 0 || remKm > 0) {
                    // Dynamic ETA based on current truck speed (in-game → real-world via sdkScale)
                    const currentSpeed = avgSpeed > 10 ? avgSpeed : 60;
                    const dynamicInGameHours = remKm / currentSpeed;
                    const dynamicRealHours = dynamicInGameHours / sdkScale;

                    // Blend the original ETA (real-world from cache) with dynamic real-world ETA
                    const blendedHours = (dynamicRealHours + remRealHours) / 2;

                    // Add Traffic Delay (convert in-game to real-world) — prorated by remaining distance
                    const { routeTrafficInfo } = useTrafficData();
                    const fullTrafficDelay = routeTrafficInfo.value?.trafficDelayMinutes || 0;
                    const remainingRatio = totalKm > 0 ? remKm / totalKm : 1;
                    const proratedTrafficDelay = fullTrafficDelay * remainingRatio;
                    const trafficDelayInGameHours = proratedTrafficDelay / 60;
                    const trafficDelayRealHours = trafficDelayInGameHours / sdkScale;
                    const finalRealHours = blendedHours + trafficDelayRealHours;
                    
                    const h = Math.floor(finalRealHours);
                    const m = Math.round((finalRealHours - h) * 60);
                    
                    let trafficDelayStr = "";
                    if (trafficDelayRealHours > 0) {
                        trafficDelayStr = ` (+${Math.round(trafficDelayRealHours * 60)}m traffic)`;
                    }
                    
                    routeEta.value = `${h}h ${m}min${trafficDelayStr}`;

                    // Compute arrival time (including traffic)
                    const now = new Date();
                    const arrivalDate = new Date(now.getTime() + finalRealHours * 3600000);
                    arrivalTime.value = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    routeEta.value = "Arriving...";
                    arrivalTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

        if (fullRouteDirections.value.length > 1) {
            const upcomingTurn = fullRouteDirections.value[1];

            if (upcomingTurn && upcomingTurn.cumulativeKm !== undefined) {
                // 1. Keep visual distance calculating to the START of the turn (Arrow Tail)
                const distKm = upcomingTurn.cumulativeKm - currentKm;
                const distRounded = +distKm.toFixed(1);

                nextTurnDistance.value = Math.max(0, distRounded);

                // 2. Base the removal threshold on the END of the turn (Arrow Head)
                const targetExitKm =
                    upcomingTurn.exitCumulativeKm !== undefined
                        ? upcomingTurn.exitCumulativeKm
                        : upcomingTurn.cumulativeKm;

                const distToExit = targetExitKm - currentKm;
                const threshold =
                    upcomingTurn.type === "destination" ? 0.02 : 0.05;

                // Shift the array ONLY when we pass the Head of the arrow
                if (distToExit < threshold) {
                    fullRouteDirections.value.shift();

                    if (
                        currentRoutePath.value &&
                        activeSettings.value.hasTurnNavigation
                    ) {
                        drawTurnArrows(
                            fullRouteDirections.value,
                            currentRoutePath.value,
                        );
                    }
                }
            }
        } else {
            nextTurnDistance.value = 0;
        }

        // Update progress marker position at the exact closest point on the route to the truck
        // Uses projectPointToSegment for accuracy instead of visualProgress-based interpolation
        if (map.value && currentRoutePath.value && currentRoutePath.value.length > 1) {
            const path = currentRoutePath.value;
            // Small local search around currentRouteIndex for the closest segment to the truck
            const searchStart = Math.max(0, currentRouteIndex.value - 2);
            const searchEnd = Math.min(path.length - 1, currentRouteIndex.value + 3);
            let bestSegIdx = currentRouteIndex.value;
            let bestSegDist = getSqDistToSegment(truckCoords, path[bestSegIdx]!, path[bestSegIdx + 1]!);
            for (let i = searchStart; i < searchEnd; i++) {
                const d = getSqDistToSegment(truckCoords, path[i]!, path[i + 1]!);
                if (d < bestSegDist) {
                    bestSegDist = d;
                    bestSegIdx = i;
                }
            }
            // Project truck position onto the closest route segment for exact placement
            const pos = projectPointToSegment(truckCoords, path[bestSegIdx]!, path[bestSegIdx + 1]!);
            
            const source = map.value.getSource("route-progress-marker") as GeoJSONSource;
            if (source) {
                source.setData({
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry: { type: "Point", coordinates: pos },
                        properties: {},
                    }],
                });
            }

            // Update alt route progress marker at proportional position
            const altPath = altRoutePath.value;
            if (altPath && altPath.length > 1) {
                const altRatio = visualProgress.value / (path.length - 1);
                const altFloatIdx = altRatio * (altPath.length - 1);
                const altIdx = Math.max(0, Math.min(Math.floor(altFloatIdx), altPath.length - 1));
                const altFrac = altFloatIdx - altIdx;
                const a1 = altPath[Math.min(altIdx, altPath.length - 1)]!;
                const a2 = altPath[Math.min(altIdx + 1, altPath.length - 1)]!;
                const altPos: [number, number] = [
                    a1[0] + (a2[0] - a1[0]) * altFrac,
                    a1[1] + (a2[1] - a1[1]) * altFrac,
                ];

                const altSource = map.value.getSource("alt-route-progress-marker") as GeoJSONSource;
                if (altSource) {
                    altSource.setData({
                        type: "FeatureCollection",
                        features: [{
                            type: "Feature",
                            geometry: { type: "Point", coordinates: altPos },
                            properties: {},
                        }],
                    });
                }
            }
        }

        // Slice route path into passed and remaining sections
        // Uses bestIndex (same as distance/ETA) so grey/blue split stays perfectly in sync
        if (map.value && currentRoutePath.value && currentRoutePath.value.length > 0) {
            const displayIndex = Math.min(bestIndex, currentRoutePath.value.length - 1);
            
            // Only update GeoJSON when the visual display index actually changes
            if (displayIndex !== lastDrawnVisualIndex) {
                lastDrawnVisualIndex = displayIndex;
                
                const passedPath = currentRoutePath.value.slice(0, displayIndex + 1);
                const remainingPath = currentRoutePath.value.slice(displayIndex);

                if (passedPath.length > 1) {
                    setMapLibreData(map.value, "route-passed-line", "LineString", passedPath, { color: "#5a6a7c" });
                }
                if (remainingPath.length > 1) {
                    // Preserve traffic congestion colors when redrawing the route on progress update
                    const { routeTrafficInfo } = useTrafficData();
                    const colors = routeTrafficInfo.value?.routeColors;
                    const fullPath = currentRoutePath.value;
                    if (colors && colors.length === fullPath.length - 1) {
                        // Draw remaining path with per-segment traffic colors
                        const remainingColors = colors.slice(displayIndex);
                        const features = [];
                        for (let i = 0; i < remainingPath.length - 1; i++) {
                            const props: any = {};
                            if (remainingColors[i]) props.color = remainingColors[i];
                            features.push({
                                type: "Feature",
                                geometry: {
                                    type: "LineString",
                                    coordinates: [remainingPath[i], remainingPath[i + 1]],
                                },
                                properties: props,
                            });
                        }
                        const source = map.value.getSource("route-line") as GeoJSONSource;
                        if (source) {
                            source.setData({
                                type: "FeatureCollection",
                                features: features as any,
                            });
                        }
                    } else {
                        setMapLibreData(map.value, "route-line", "LineString", remainingPath, { color: activeSettings.value.routeColor });
                    }
                }
            }
        }

        const now = Date.now();
        if (now - lastRecalcTime.value < 5000) return;

        if (isTruckInYard.value) {
            activeThreshold = 0.05;
        } else if (isYardStart.value) {
            if (bestIndex > 0) {
                isYardStart.value = false;
            } else {
                activeThreshold = 0.005;
            }
        }

        if (minSqDist > activeThreshold) {
            if (!isCalculating.value && !routeSelectionMode.value && savedDestination.value) {
                lastRecalcTime.value = now;
                console.log("Deviation detected! Recalculating...");
                isRerouting.value = true;

                // Fade out current route → recalculate → fade in new route
                const dest = toRaw(savedDestination.value) as [number, number];
                animateRouteOpacity(0, 250).then(() => {
                    handleRouteClick(
                        dest,
                        truckCoords,
                        truckHeading,
                        sdkScale,
                        false,
                        avgSpeed,
                        true,
                    ).finally(() => {
                        isRerouting.value = false;
                        // Fade in the new route
                        animateRouteOpacity(1, 300);
                    });
                });
                return;
            }
        }
    };

    function clearRouteState() {
        if (!map.value) return;

        deleteMapLibreData(map.value, "route-line");
        deleteMapLibreData(map.value, "alt-route-line");
        deleteMapLibreData(map.value, "destination-source");
        deleteMapLibreData(map.value, "route-progress-marker");
        deleteMapLibreData(map.value, "alt-route-progress-marker");
        deleteMapLibreData(map.value, "turn-arrows-line-source");
        deleteMapLibreData(map.value, "turn-arrows-head-source");

        stopProgressPulse();

        isRouteActive.value = false;
        routeSelectionMode.value = false;
        isAltDisplayedAsPrimary.value = false;
        endNodeId.value = null;
        currentRoutePath.value = null;
        savedDestination.value = null;
        isYardStart.value = false;
        fullRouteDirections.value = [];
        altRoutePath.value = null;
        altRouteEta.value = "";
        altRouteDistance.value = 0;
        altRouteStats.value = null;
        altRouteTrafficDelay.value = "";
        altNodeSequence.value = [];
        altNodeKms.value = null;
        altSequenceManeuvers.value = null;
        altSequenceExits.value = null;
        mainNodeSequence.value = [];
        mainNodeKms.value = null;
        mainSequenceManeuvers.value = null;
        mainSequenceExits.value = null;
        updateProfile("lastDestination", null);
        stopNavigationMode();

        nextTurnDistance.value = 0;
        lastMathPos.value = null;
        lastDrawnVisualIndex = -1;
        // Reset opacity for next route
        routeOpacity.value = 1;
        altRouteOpacity.value = 0.7;
        if (routeAnimFrame !== null) {
            cancelAnimationFrame(routeAnimFrame);
            routeAnimFrame = null;
        }
    }

        function confirmSelectedRoute(index: 0 | 1) {
            // If display was swapped because alt is faster, map button index back to actual route
            const actualIndex = isAltDisplayedAsPrimary.value ? (index === 0 ? 1 : 0) : index;
            isAltDisplayedAsPrimary.value = false;

            // Use actualIndex instead of index for route selection logic
            if (actualIndex === 1 && altRoutePath.value) {
                // User chose the alt route - swap alt to main
                // Keep original main as new alt
                const oldMainPath = currentRoutePath.value;
                const oldMainDist = routeDistance.value;
                const oldMainEta = routeEta.value;
                const oldMainStats = routeStatsCache.value;

                // Save old main raw data for swap-back alt
                const oldMainNodeSeq = mainNodeSequence.value;
                const oldMainNodeKms = mainNodeKms.value;
                const oldMainManeuvers = mainSequenceManeuvers.value;
                const oldMainExits = mainSequenceExits.value;

                // Make alt the new main
                currentRoutePath.value = altRoutePath.value;
                routeDistance.value = altRouteDistance.value;
                routeEta.value = altRouteEta.value;
                routeStatsCache.value = altRouteStats.value;

                // Restore main raw data from alt (for correct directions)
                mainNodeSequence.value = altNodeSequence.value;
                mainNodeKms.value = altNodeKms.value;
                mainSequenceManeuvers.value = altSequenceManeuvers.value;
                mainSequenceExits.value = altSequenceExits.value;

                // Regenerate directions for the alt route (now main)
                if (mainNodeSequence.value.length > 0 && mainNodeKms.value) {
                    fullRouteDirections.value = generateDirectionsList(
                        mainNodeSequence.value,
                        mainNodeKms.value,
                        mainSequenceManeuvers.value!,
                        mainSequenceExits.value!,
                        nodeCoords,
                        {
                            headOnRoute: t('directions.headOnRoute'),
                            turnLeft: t('directions.turnLeft'),
                            turnRight: t('directions.turnRight'),
                            keepLeft: t('directions.keepLeft'),
                            keepRight: t('directions.keepRight'),
                            takeExit: t('directions.takeExit'),
                            exitAtRoundabout: t('directions.exitAtRoundabout'),
                            roundaboutExit: (exitCount: number, suffix: string) =>
                                t('directions.roundaboutExit')
                                    .replace('{number}', String(exitCount))
                                    .replace('{suffix}', suffix),
                            arrived: t('directions.arrived'),
                        },
                    );
                }

                // Update nextTurnDistance after regenerating directions
                if (fullRouteDirections.value.length > 1) {
                    const upcomingTurn = fullRouteDirections.value[1];
                    if (upcomingTurn && upcomingTurn.cumulativeKm !== undefined) {
                        const distKm = +upcomingTurn.cumulativeKm.toFixed(1);
                        nextTurnDistance.value = Math.max(0, distKm);
                    }
                } else {
                    nextTurnDistance.value = 0;
                }

                // Old main becomes new alt — store its raw data for potential swap-back
                altNodeSequence.value = oldMainNodeSeq;
                altNodeKms.value = oldMainNodeKms;
                altSequenceManeuvers.value = oldMainManeuvers;
                altSequenceExits.value = oldMainExits;

                // Compute traffic delay for the old main (now alt) using stored sdkScale
                const { trafficPoints } = useTrafficData();
                const tp = trafficPoints.value || [];
                if (oldMainPath) {
                    const oldMainTrafficInfo = calculateRouteTrafficInfo(tp, oldMainPath);
                    const scale = lastSdkScale.value > 0 ? lastSdkScale.value : (settings.value.selectedGame === "ats" ? 20 : 19);
                    const oldMainDelayMin = oldMainTrafficInfo ? Math.round(oldMainTrafficInfo.trafficDelayMinutes / scale) : 0;
                    altRouteTrafficDelay.value = oldMainDelayMin > 0 ? `+${oldMainDelayMin}m` : "";
                } else {
                    altRouteTrafficDelay.value = "";
                }

                altRoutePath.value = oldMainPath as any;
                altRouteDistance.value = oldMainDist;
                altRouteEta.value = oldMainEta;
                altRouteStats.value = oldMainStats as any;

                // Redraw routes on map
                if (map.value) {
                    setMapLibreData(map.value, "route-line", "LineString", currentRoutePath.value, { color: activeSettings.value.routeColor });
                    setMapLibreData(map.value, "alt-route-line", "LineString", altRoutePath.value);
                }
            }

            // Draw turn arrows for the now-selected main route
            if (activeSettings.value.hasTurnNavigation && fullRouteDirections.value.length > 0 && currentRoutePath.value) {
                drawTurnArrows(fullRouteDirections.value, currentRoutePath.value);
            }

            // Activate route
            isRouteActive.value = true;
            routeFound.value = true;
            routeSelectionMode.value = false;
            startProgressPulse();
        }

        function swapToAltRoute() {
            if (!altRoutePath.value || !map.value) return;
            isAltDisplayedAsPrimary.value = false;

            // Make alt route the main route
            currentRoutePath.value = altRoutePath.value;
            routeDistance.value = altRouteDistance.value;
            routeEta.value = altRouteEta.value;
            if (altRouteStats.value) {
                routeStatsCache.value = altRouteStats.value;
            }

            // Restore main raw data from alt (for correct directions)
            mainNodeSequence.value = altNodeSequence.value;
            mainNodeKms.value = altNodeKms.value;
            mainSequenceManeuvers.value = altSequenceManeuvers.value;
            mainSequenceExits.value = altSequenceExits.value;

            // Regenerate directions for the alt route (now main)
            if (mainNodeSequence.value.length > 0 && mainNodeKms.value) {
                fullRouteDirections.value = generateDirectionsList(
                    mainNodeSequence.value,
                    mainNodeKms.value,
                    mainSequenceManeuvers.value!,
                    mainSequenceExits.value!,
                    nodeCoords,
                    {
                        headOnRoute: t('directions.headOnRoute'),
                        turnLeft: t('directions.turnLeft'),
                        turnRight: t('directions.turnRight'),
                        keepLeft: t('directions.keepLeft'),
                        keepRight: t('directions.keepRight'),
                        takeExit: t('directions.takeExit'),
                        exitAtRoundabout: t('directions.exitAtRoundabout'),
                        roundaboutExit: (exitCount: number, suffix: string) =>
                            t('directions.roundaboutExit')
                                .replace('{number}', String(exitCount))
                                .replace('{suffix}', suffix),
                        arrived: t('directions.arrived'),
                    },
                );
            }

            // Update nextTurnDistance after regenerating directions
            if (fullRouteDirections.value.length > 1) {
                const upcomingTurn = fullRouteDirections.value[1];
                if (upcomingTurn && upcomingTurn.cumulativeKm !== undefined) {
                    const distKm = +upcomingTurn.cumulativeKm.toFixed(1);
                    nextTurnDistance.value = Math.max(0, distKm);
                }
            } else {
                nextTurnDistance.value = 0;
            }

            // Redraw turn arrows with new directions
            if (activeSettings.value.hasTurnNavigation && currentRoutePath.value) {
                drawTurnArrows(fullRouteDirections.value, currentRoutePath.value);
            }

            // Clear alternative route
            altRoutePath.value = null;
            altRouteEta.value = "";
            altRouteDistance.value = 0;
            altRouteStats.value = null;
            altNodeSequence.value = [];
            altNodeKms.value = null;
            altSequenceManeuvers.value = null;
            altSequenceExits.value = null;

            // Redraw
            if (map.value) {
                setMapLibreData(map.value, "route-line", "LineString", currentRoutePath.value, { color: activeSettings.value.routeColor });
                deleteMapLibreData(map.value, "alt-route-line");
                deleteMapLibreData(map.value, "alt-route-progress-marker");
            }
        }

        return {
            worker,
            destinationName,
            routeDistance,
            routeEta,
            arrivalTime,
            isCalculating,
            isRerouting,
            routeFound,
            currentRoutePath,
            altRoutePath,
            altRouteEta,
            altRouteDistance,
            altRouteTrafficDelay,
            hasAltRoute,
            isWorkerReady,
            isRouteActive,
            fullRouteDirections,
            nextTurnDistance,
            routeSelectionMode,
            selectionMainDistance,
            selectionMainEta,
            selectionMainTrafficDelay,
            selectionAltDistance,
            selectionAltEta,
            selectionAltTrafficDelay,
            selectionTimeDiff,
            isAltDisplayedAsPrimary,
            confirmSelectedRoute,
            initWorkerData,
            destroyWorker,
            setupRouteLayer,
            handleRouteClick,
            findBestStartConfiguration,
            updateRouteProgress,
            clearRouteState,
            redrawRouteWithTraffic,
            swapToAltRoute,
        };
};
