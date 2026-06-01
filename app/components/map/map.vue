<script lang="ts" setup>
import { ref, onMounted, shallowRef, Transition } from "vue";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { usePlatform } from "~/composables/Platform";
import { blendWithBg, lightenColor } from "~/assets/utils/shared/colors";
import { generateTruckIcon } from "~/assets/utils/map/markers";
import type { CityData } from "~/composables/useCitySearch";
import { convertEts2ToGeo, convertAtsToGeo } from "~/assets/utils/map/converters";
import { cleanupMapLibre } from "~/composables/MapLibre";

defineProps<{ goHome: () => void }>();

// MAP STATE
const mapEl = shallowRef<HTMLElement | null>(null);
const map = shallowRef<maplibregl.Map | null>(null);
const isSettingsPanelOpened = ref(false);
const isClickingEnabled = ref(false);

// UI STATE
const isSheetHidden = ref(false);

// JOB STATE
const currentJobKey = ref<string>("");

// NOTIFICATION TRIGGERS
const clickingNotificationTrigger = ref(0);

//
//
//// ======> COMPOSABLES <======

//
//
// Telemetry Data
const {
    startTelemetry,
    stopTelemetry,
    gameTime,
    gameConnected,
    truckCoords,
    truckSpeed,
    speedLimit,
    truckHeading,
    fuel,
    restStoptime,
    restStopMinutes,
    hasInGameMarker,
    hasActiveJob,
    destinationCity,
    scale,
    averageSpeed,
    destinationCompany,
} = useEtsTelemetry();

//
//
// Map Areas Data
const { loadLocationData, findDestinationCoords } = useCityData();

//
//
// Check Platform
const { isElectron, isMobile, isWeb } = usePlatform();

//
//
// Graph manipulation
const { loading, progress, adjacency, nodeCoords, initializeGraphData } =
    useGraphSystem();

//
//
// Maplibre Camera
const {
    isCameraLocked,
    isAutoFollowEnabled,
    isNavigating,
    initCameraListeners,
    followTruck,
    startNavigationMode,
    stopNavigationMode,
    initMarker,
    updateMarkerSize,
    updateMarkerImage,
    toggleAutoFollow,
    is3DMode,
    toggle3DMode,
    setTurnCamera,
    resumeCameraLock,
} = useMapCamera(map);

//
//
// Route Controller
const {
    setupRouteLayer,
    handleRouteClick,
    updateRouteProgress,
    clearRouteState,
    destinationName,
    routeDistance,
    routeEta,
    arrivalTime,
    isCalculating: isCalculatingRoute,
    isRerouting: isReroutingRoute,
    isWorkerReady,
    initWorkerData,
    destroyWorker,
    isRouteActive,
    routeFound,
    fullRouteDirections,
    nextTurnDistance,
    currentRoutePath,
    redrawRouteWithTraffic,
    hasAltRoute,
    altRouteEta,
    altRouteTrafficDelay,
    swapToAltRoute,
    routeSelectionMode,
    selectionMainDistance,
    selectionMainEta,
    selectionMainTrafficDelay,
    selectionAltDistance,
    selectionAltEta,
    selectionAltTrafficDelay,
    selectionTimeDiff,
    confirmSelectedRoute,
} = useRouteController(map, adjacency, nodeCoords, stopNavigationMode);

//
// Settings Controller
const { activeSettings, settings } = useSettings();
const { t } = useTranslations();
const { speakWarning } = useVoiceWarnings();

let spoken1km = false;
let spoken200m = false;
let currentInstruction = "";
const isInOverviewMode = ref(false);
let lastCongestedSegments = 0;

watch([nextTurnDistance, fullRouteDirections, isNavigating], ([dist, dirs, nav]) => {
    if (!nav) {
        setTurnCamera(false);
        return;
    }
    
    // Auto-zoom on turns
    if (dist > 0 && dist < 0.8) {
        setTurnCamera(true);
    } else {
        setTurnCamera(false);
    }

    if (!activeSettings.value.voiceWarnings) return;
    const nextInstruction = dirs[1]?.text;
    if (!nextInstruction) return;

    if (nextInstruction !== currentInstruction) {
        currentInstruction = nextInstruction;
        spoken1km = false;
        spoken200m = false;
    }

    if (dist > 0 && dist < 1.0 && !spoken1km) {
        speakWarning('turn_1km', nextInstruction, 5);
        spoken1km = true;
    }
    
    if (dist > 0 && dist < 0.2 && !spoken200m) {
        speakWarning('turn_200m', nextInstruction, 5);
        spoken200m = true;
    }
});



//
//
// Traffic Data
const {
    setupTrafficLayers,
    startPolling,
    stopPolling,
    setEnabled,
    routeTrafficInfo,
} = useTrafficData();

// Traffic Alert Voice
watch(routeTrafficInfo, (info) => {
    if (!info || !activeSettings.value.voiceWarnings) return;
    const segments = info.congestedSegments || 0;
    const delayMin = Math.round(info.trafficDelayMinutes || 0);
    if (segments > 0 && segments > lastCongestedSegments) {
        const msg = t('warnings.trafficAhead').replace('{delay}', String(delayMin));
        speakWarning('traffic_ahead', msg, 120);
    }
    lastCongestedSegments = segments;
});

let uiTimer: ReturnType<typeof setTimeout> | null = null;
let routeTimer: ReturnType<typeof setTimeout> | null = null;

// Forcing loading screen before mounting elements to prevent flashing between game changes
loading.value = true;
progress.value = 0;

const isTruckSpawned = computed(() => {
    return (
        truckCoords.value &&
        (truckCoords.value[0] !== 0 || truckCoords.value[1] !== 0)
    );
});

// We check if it has active job, if it has one, plot a route
watch(
    [
        hasActiveJob,
        destinationCity,
        destinationCompany,
        gameConnected,
        loading,
        isWorkerReady,
        isTruckSpawned,
    ],
    async ([
        hasJob,
        city,
        company,
        isConnected,
        isLoading,
        isWorkerReady,
        truckReady,
    ]) => {
        if (!truckCoords.value) return;
        if (isLoading || !isWorkerReady || !isConnected || !truckReady) {
            currentJobKey.value = "";
            return;
        }

        const newJobKey = hasJob ? `${city}|${company}` : "";

        if (hasJob && newJobKey === currentJobKey.value) return;

        if (routeTimer) clearTimeout(routeTimer);

        if (hasJob && newJobKey !== currentJobKey.value) {
            const destCoords = findDestinationCoords(city, company);

            if (destCoords) {
                currentJobKey.value = newJobKey;
                clearRouteState();
                isClickingEnabled.value = false;

                await handleRouteClick(
                    destCoords,
                    truckCoords.value,
                    truckHeading.value,
                    scale.value,
                    false,
                    averageSpeed.value,
                );

                isClickingEnabled.value = false;
            }
        } else if (!hasJob && currentJobKey.value !== "") {
            clearRouteState();
            stopNavigationMode();
            currentJobKey.value = "";
            isClickingEnabled.value = false;
        }
    },
);

watch(
    [hasActiveJob, gameConnected, loading, isWorkerReady, isTruckSpawned],
    ([hasJob, isGameConnected, isLoading, isWorkerReady, truckReady]) => {
        if (!truckCoords.value) return;
        if (
            isLoading ||
            !isWorkerReady ||
            !isGameConnected ||
            hasJob ||
            !truckReady
        )
            return;

        const destination = activeSettings.value.lastDestination;

        if (destination && !isRouteActive.value && !isCalculatingRoute.value) {
            handleRouteClick(
                destination,
                truckCoords.value,
                truckHeading.value,
                scale.value,
                true,
                averageSpeed.value,
            );
        }
    },
);

// We check each time the theme color changes to udate the map libre appsettings.default theme color
watch(
    () => activeSettings.value.themeColor,
    async (newColor) => {
        if (!map.value) return;

        const newTruckImg = await generateTruckIcon(newColor);
        updateMarkerImage(newTruckImg.src);

        if (map.value.getLayer("prefab-zones")) {
            const blended = blendWithBg(lightenColor(newColor, 0.3), 0.6);
            map.value.setPaintProperty("prefab-zones", "fill-color", blended);
        }
    },
);

// We check each time the truck marker size changes to update the map libre truck marker elemeent size
watch(
    () => settings.value.truckMarkerSize,
    (newSize) => {
        if (newSize) {
            updateMarkerSize(newSize);
        }
    },
);

// We check each time the text font changes to udate to the settings text font
watch(
    () => activeSettings.value.fontFamily,
    (newFont) => {
        if (!map.value) return;

        const textLayers = [
            "village-labels",
            "city-labels",
            "capital-major-labels",
            "country-labels",
        ];

        textLayers.forEach((layerId) => {
            if (map.value!.getLayer(layerId)) {
                map.value!.setLayoutProperty(layerId, "text-font", [newFont]);
            }
        });
    },
);

// We set the routeFound back to null with a delay if its true / false.
watch(routeFound, (newVal) => {
    if (newVal !== null) {
        if (uiTimer) clearTimeout(uiTimer);

        uiTimer = setTimeout(() => {
            routeFound.value = null;
        }, 1000);
    }
});

// When loaded, checks gameConnected -> show map
watch([loading, gameConnected], ([isLoading, isGameConnected]) => {
    if (!isLoading) {
        setTimeout(() => {
            isCameraLocked.value = true;
        }, 100);

        if (isGameConnected) {
            setTimeout(() => {
                isCameraLocked.value = true;
            }, 500);
        }
    }
});

watch(gameConnected, (isConnected) => {
    if (!map.value) return;
    if (!isConnected) {
        isCameraLocked.value = false;
        clearRouteState();
    }
});

// Watch for traffic setting changes
watch(
    () => activeSettings.value.showTraffic,
    (enabled) => {
        if (!map.value) return;
        const game = settings.value.selectedGame || "ets2";
        setEnabled(enabled, map.value, game);
    },
);

// Watch for route or traffic settings changes to update polling
watch(
    [currentRoutePath, () => activeSettings.value.showTraffic, () => activeSettings.value.trafficServerId],
    ([routePath, showTraffic]) => {
        if (!map.value || !showTraffic) return;
        const game = settings.value.selectedGame || "ets2";
        startPolling(map.value, game, routePath || undefined);
    },
);

watch(
    () => routeTrafficInfo.value?.routeColors,
    (colors) => {
        // Apply traffic colors to the route whenever they update,
        // even during route selection mode (before isRouteActive is true)
        if (!currentRoutePath.value) return;
        redrawRouteWithTraffic(colors || null);
    }
);

onMounted(async () => {
    // eruda.init(); // KEEP FOR DEBUGGING MOBILE
    await loadLocationData();
    if (!mapEl.value) return;
    if (isElectron.value) {
        (window as any).electronAPI.setWindowSize(950, 700, true, true);
    }

    try {
        const mapInstance = await initializeMap(mapEl.value);
        map.value = markRaw(mapInstance);
        if (!map.value) return;

        // Add Zoom Control
        map.value.addControl(new maplibregl.NavigationControl({
            showCompass: false,
            showZoom: true
        }), "bottom-right");

        // Add Scale Control
        map.value.addControl(new maplibregl.ScaleControl({
            maxWidth: 100,
            unit: activeSettings.value.units === 'metric' ? 'metric' : 'imperial'
        }), "bottom-right");

        const initialTruckImg = await generateTruckIcon(
            activeSettings.value.themeColor,
        );
        map.value.on("load", async () => {
            initMarker(initialTruckImg.src, settings.value.truckMarkerSize);
            const graphData = await initializeGraphData();
            if (!graphData) return;

            initWorkerData(
                graphData.nodes,
                graphData.graphBuffer,
                graphData.geometryBuffer,
            );

            setupRouteLayer();
            initCameraListeners();

            // Setup traffic layers
            // map is guaranteed non-null inside the load callback
            const m = map.value!;
            setupTrafficLayers(m);

            // Start traffic polling if enabled
            if (activeSettings.value.showTraffic) {
                const game = settings.value.selectedGame || "ets2";
                setEnabled(true, m, game);
            }
        });

        map.value.on("click", async (e) => {
            const features = map.value!.queryRenderedFeatures(e.point, {
                layers: ["destination-layer"],
            });
            if (features.length > 0) return;

            console.log(
                ` ${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`,
            ); // KEEP FOR DEBUGGING BUGGED AREAS
            if (!isClickingEnabled.value) return;
            if (!gameConnected.value) return;
            if (!truckCoords.value || (truckCoords.value[0] === 0 && truckCoords.value[1] === 0)) return;

            const currentScale =
                scale.value > 0
                    ? scale.value
                    : settings.value.selectedGame === "ats"
                      ? 20
                      : 19;

            await handleRouteClick(
                [e.lngLat.lng, e.lngLat.lat],
                truckCoords.value,
                truckHeading.value,
                currentScale,
                true,
                averageSpeed.value,
            );
        });

        startTelemetry(() => {
            onTelemetryUpdate();
        });
    } catch (e) {
        console.error(e);
    }
});

onUnmounted(() => {
    stopTelemetry();
    destroyWorker();
    stopPolling();
    cleanupMapLibre();

    if (routeTimer) clearTimeout(routeTimer);
    if (uiTimer) clearTimeout(uiTimer);

    if (map.value) {
        map.value.remove();
        map.value = null;
    }
});

function onTelemetryUpdate() {
    if (!truckCoords.value || !map.value) return;

    followTruck(truckCoords.value, truckHeading.value);

    if (isRouteActive.value) {
        updateRouteProgress(
            truckCoords.value,
            truckHeading.value,
            scale.value,
            averageSpeed.value,
        );
    }
}

function onStartNavigation() {
    if (!truckCoords.value) return;

    startNavigationMode(truckCoords.value, truckHeading.value);

    isSheetHidden.value = true;
}

function onSheetClosed() {
    isSheetHidden.value = false;
}

function onCitySelect(city: CityData) {
    if (!map.value) return;
    
    // Convert game coordinates to geographical coordinates
    const isAts = settings.value.selectedGame === "ats";
    const coords = isAts 
        ? convertAtsToGeo(city.x, city.y) 
        : convertEts2ToGeo(city.x, city.y);
        
    map.value.flyTo({
        center: [coords[0], coords[1]],
        zoom: 9,
        duration: 1500,
    });
}

function toggleEnableClicking() {
    isClickingEnabled.value = !isClickingEnabled.value;

    clickingNotificationTrigger.value++;
}

const onResetNorth = () => {
    map.value?.easeTo({
        bearing: 0,
        pitch: 0,
        duration: 500,
    });
};

const onRouteOverview = () => {
    if (!map.value || !currentRoutePath.value || currentRoutePath.value.length === 0) return;
    const path = currentRoutePath.value;
    
    const firstPt = path[0];
    if (!firstPt) return;
    
    let minLng = firstPt[0];
    let minLat = firstPt[1];
    let maxLng = firstPt[0];
    let maxLat = firstPt[1];

    for (let i = 1; i < path.length; i++) {
        const pt = path[i];
        if (!pt) continue;
        if (pt[0] < minLng) minLng = pt[0];
        if (pt[0] > maxLng) maxLng = pt[0];
        if (pt[1] < minLat) minLat = pt[1];
        if (pt[1] > maxLat) maxLat = pt[1];
    }
    
    isInOverviewMode.value = true;
    map.value.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 80, duration: 1500 }
    );
};

const onResumeNavigation = () => {
    isInOverviewMode.value = false;
    resumeCameraLock();
};

const onToggleFullscreen = async () => {
    const target = document.documentElement;

    try {
        if (!document.fullscreenElement) {
            await target.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        }

        setTimeout(() => {
            map.value?.resize();
        }, 100);
    } catch (err) {
        console.error("Fullscreen error:", err);
    }
};

const toggleSettingsPanel = () => {
    isSettingsPanelOpened.value = !isSettingsPanelOpened.value;
};

const onCancelRoute = () => {
    clearRouteState();
    stopNavigationMode();
    isClickingEnabled.value = false;
};
</script>

<template>
    <div
        ref="wrapperEl"
        class="full-page-wrapper"
        :class="{ 'platform-mobile': isMobile }"
    >
        <div ref="mapEl" class="map-container" :class="{ 'is-daytime': activeSettings.textColor === 'light' }"></div>

        <div class="ui-safe-container">
            <Transition name="ui-layer-fade">
                <div v-show="!isSettingsPanelOpened" class="map-ui-layer">
                    <Transition name="fade">
                        <LoadingScreen v-if="loading" :progress="progress" />
                    </Transition>
                    
                    <RerouteToast :is-calculating="isCalculatingRoute" :is-rerouting="isReroutingRoute" />

                    <SearchBar @select="onCitySelect" />

                    <TopBar
                        v-show="settings.activeUiComponents.includes('topBar')"
                        :fuel="fuel"
                        :game-connected="gameConnected"
                        :game-time="gameTime"
                        :rest-stop-minutes="restStopMinutes"
                        :rest-stop-time="restStoptime"
                        :truck-speed="truckSpeed"
                        :is-web="isWeb"
                    />

                    <TrafficProgressBar />
                    <CurrentLocation :truck-coords="truckCoords" />

                    <div class="left-buttons">
                        <HudButton :onClick="goHome">
                            <Icon name="lucide:arrow-left" class="icon" />
                        </HudButton>

                        <HudButton :onClick="toggleSettingsPanel">
                            <Icon name="lucide:settings" class="icon" />
                        </HudButton>
                    </div>

                    <ManeuverCard
                        v-show="
                            isNavigating && activeSettings.hasTurnNavigation
                        "
                        :upcoming-turns="fullRouteDirections"
                        :distance-to-next-turn="nextTurnDistance"
                        :next-instruction="
                            fullRouteDirections[1]?.text || t('map.followRoute')
                        "
                    />

                    <NotificationGeneral
                        :trigger="clickingNotificationTrigger"
                        :text="
                            isClickingEnabled
                                ? t('map.tappingEnabled')
                                : t('map.tappingDisabled')
                        "
                    >
                        <template #icon>
                            <Icon
                                v-if="isClickingEnabled"
                                class="notification-icon"
                                name="lucide:pointer"
                                size="24"
                                :style="{ color: '#4caf50' }"
                            />

                            <Icon
                                v-else
                                class="notification-icon"
                                name="lucide:pointer-off"
                                size="24"
                                :style="{ color: '#dd4a34' }"
                            />
                        </template>
                    </NotificationGeneral>

                    <NotificationRoute
                        :is-route-found="routeFound"
                        :is-calculating-route="isCalculatingRoute"
                    />

                    <div class="hud-buttons">
                        <HudButton v-if="isWeb" :onClick="onToggleFullscreen">
                            <Icon name="lucide:fullscreen" class="icon" />
                        </HudButton>

                        <HudButton v-if="isRouteActive" :onClick="onRouteOverview">
                            <Icon name="lucide:route" class="icon" />
                        </HudButton>

                        <HudButton :onClick="onResetNorth">
                            <Icon name="lucide:compass" class="icon" />
                        </HudButton>

                        <HudButton
                            :is-active="isAutoFollowEnabled"
                            :class="{ 'green-icon': isAutoFollowEnabled }"
                            :onClick="toggleAutoFollow"
                        >
                            <Icon
                                v-if="isAutoFollowEnabled"
                                name="lucide:locate-fixed"
                                class="icon"
                            />
                            <Icon v-else name="lucide:locate" class="icon" />
                        </HudButton>

                        <HudButton
                            :is-active="is3DMode"
                            :class="{ 'green-icon': is3DMode }"
                            :onClick="toggle3DMode"
                        >
                            <Icon name="lucide:box" class="icon" />
                        </HudButton>

                        <HudButton
                            :is-active="isClickingEnabled"
                            :class="
                                isClickingEnabled ? 'green-icon' : 'red-icon'
                            "
                            :onClick="toggleEnableClicking"
                        >
                            <Icon
                                v-if="isClickingEnabled"
                                name="lucide:pointer"
                                class="icon"
                            />
                            <Icon
                                v-else
                                name="lucide:pointer-off"
                                class="icon"
                            />
                        </HudButton>
                    </div>

                    <SpeedLimit
                        v-show="
                            speedLimit > 0 &&
                            settings.activeUiComponents.includes('speedLimit')
                        "
                        :truck-speed="truckSpeed"
                        :speed-limit="speedLimit"
                    />

                    <FloatingSpeed
                        v-if="isNavigating"
                        :truck-speed="truckSpeed"
                        :speed-limit="speedLimit"
                    />

                    <Transition name="resume-pop">
                        <button
                            v-if="isInOverviewMode && isNavigating"
                            class="resume-navigation-btn"
                            @click="onResumeNavigation"
                        >
                            <Icon name="lucide:navigation" />
                            {{ t('common.resume') }}
                        </button>
                    </Transition>

                    <!-- Route Selection Card (choose between fast vs alt) -->
                    <Transition name="route-select-pop">
                        <div
                            v-if="routeSelectionMode"
                            class="route-selection-overlay"
                        >
                            <div class="route-selection-card">
                                <div class="route-selection-header">
                                    <div class="header-icon-wrap">
                                        <Icon name="lucide:route" size="16" />
                                    </div>
                                    <span>{{ t('routeSelection.title') }}</span>
                                </div>
                                <div class="route-options">
                                    <div
                                        class="route-option route-option-primary"
                                        @click="confirmSelectedRoute(0)"
                                        tabindex="0"
                                        role="button"
                                        @keydown.enter="confirmSelectedRoute(0)"
                                        @keydown.space.prevent="confirmSelectedRoute(0)"
                                    >
                                        <div class="route-option-row">
                                            <div class="route-badge route-badge-fast">
                                                <Icon name="lucide:zap" size="14" />
                                            </div>
                                            <div class="route-option-info">
                                                <div class="route-option-top">
                                                    <span class="route-option-label">{{ t('routeSelection.fastest') }}</span>
                                                    <span class="route-option-desc">{{ t('routeSelection.fastDesc') }}</span>
                                                </div>
                                                <div class="route-option-stats">
                                                    <span class="stat-eta">{{ selectionMainEta }}</span>
                                                    <span class="stat-sep">·</span>
                                                    <span class="stat-dist">{{ selectionMainDistance }}km</span>
                                                    <span v-if="selectionMainTrafficDelay" class="traffic-delay-badge">
                                                        <Icon name="lucide:alert-triangle" size="10" />
                                                        {{ selectionMainTrafficDelay }}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="selectionTimeDiff.fasterLabel === 'main' && selectionTimeDiff.minutes > 0" class="time-diff-badge time-diff-faster">
                                            <Icon name="lucide:trending-down" size="12" />
                                            {{ t('routeSelection.timeDiff').replace('{min}', String(selectionTimeDiff.minutes)) }}
                                        </div>
                                    </div>
                                    <div
                                        class="route-option route-option-alt"
                                        @click="confirmSelectedRoute(1)"
                                        tabindex="0"
                                        role="button"
                                        @keydown.enter="confirmSelectedRoute(1)"
                                        @keydown.space.prevent="confirmSelectedRoute(1)"
                                    >
                                        <div class="route-option-row">
                                            <div class="route-badge route-badge-alt">
                                                <Icon name="lucide:git-branch" size="14" />
                                            </div>
                                            <div class="route-option-info">
                                                <div class="route-option-top">
                                                    <span class="route-option-label">{{ t('routeSelection.alternative') }}</span>
                                                    <span class="route-option-desc">{{ t('routeSelection.altDesc') }}</span>
                                                </div>
                                                <div class="route-option-stats">
                                                    <span class="stat-eta">{{ selectionAltEta }}</span>
                                                    <span class="stat-sep">·</span>
                                                    <span class="stat-dist">{{ selectionAltDistance }}km</span>
                                                    <span v-if="selectionAltTrafficDelay" class="traffic-delay-badge traffic-delay-badge-alt">
                                                        <Icon name="lucide:alert-triangle" size="10" />
                                                        {{ selectionAltTrafficDelay }}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="selectionTimeDiff.fasterLabel === 'alt' && selectionTimeDiff.minutes > 0" class="time-diff-badge time-diff-faster">
                                            <Icon name="lucide:trending-down" size="12" />
                                            {{ t('routeSelection.timeDiff').replace('{min}', String(selectionTimeDiff.minutes)) }}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    class="route-cancel-btn"
                                    @click="clearRouteState"
                                >
                                    <Icon name="lucide:x" size="14" />
                                    {{ t('routeSelection.cancel') }}
                                </button>
                            </div>
                        </div>
                    </Transition>

                    <!-- Alt Route Swap Card (after route is active) -->
                    <Transition name="resume-pop">
                        <div
                            v-if="hasAltRoute && isRouteActive"
                            class="alt-route-card"
                            @click="swapToAltRoute"
                        >
                            <Icon name="lucide:git-branch" class="alt-icon" />
                            <div class="alt-text-container">
                                <span class="alt-label">{{ t('routeSelection.alternative') }}</span>
                                <span class="alt-time">{{ altRouteEta }}</span>
                                <span v-if="altRouteTrafficDelay" class="alt-traffic-badge">
                                    <Icon name="lucide:alert-triangle" size="10" />
                                    {{ altRouteTrafficDelay }}
                                </span>
                            </div>
                        </div>
                    </Transition>

                    <div class="warnings">
                        <WarningSlide
                            :show-if="hasInGameMarker && !isRouteActive"
                            :reset-on="isRouteActive"
                            :text="t('map.externalRouteDetected')"
                            :action-button-label="t('map.setDestination')"
                            @action-click="toggleEnableClicking"
                        />

                        <WarningSlide
                            :show-if="!gameConnected"
                            :reset-on="gameConnected"
                            :text="t('common.gameOffline')"
                        />
                    </div>

                    <Transition name="sheet-slide" @after-leave="onSheetClosed">
                        <SheetSlide
                            v-if="isRouteActive"
                            :on-stop-navigation="onCancelRoute"
                            :is-navigating="isNavigating"
                            :on-start-navigation="onStartNavigation"
                            :destination-name="destinationName"
                            v-model:is-sheet-hidden="isSheetHidden"
                            :route-distance="routeDistance"
                            :route-eta="routeEta"
                            :arrival-time="arrivalTime"
                            :speed-limit="speedLimit"
                            :truck-speed="truckSpeed"
                        />
                    </Transition>
                </div>
            </Transition>

            <Transition name="panel-pop">
                <SettingsPanel
                    v-show="isSettingsPanelOpened"
                    :close-panel="toggleSettingsPanel"
                />
            </Transition>
        </div>
    </div>
</template>

<style scoped lang="scss" src="~/assets/scss/scoped/map/map.scss"></style>
