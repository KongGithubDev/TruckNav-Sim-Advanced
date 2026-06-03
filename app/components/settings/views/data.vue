<script lang="ts" setup>
const { settings, activeSettings, updateProfile, resetSettings } = useSettings();
const { t } = useTranslations();

const recentCount = ref(0);
const savedDest = computed(() => activeSettings.value.lastDestination);
const selectedGame = computed(() => settings.value.selectedGame || "ets2");

onMounted(() => {
    loadRecentCount();
});

function loadRecentCount() {
    try {
        const stored = localStorage.getItem("recent-destinations");
        if (stored) {
            const parsed = JSON.parse(stored);
            recentCount.value = Array.isArray(parsed) ? parsed.length : 0;
        }
    } catch {
        recentCount.value = 0;
    }
}

function clearRecentDestinations() {
    localStorage.removeItem("recent-destinations");
    recentCount.value = 0;
}

function clearRouteHistory() {
    updateProfile("lastDestination", null);
}

function clearAllLocalData() {
    const STORAGE_KEY = "truck-nav-advanced-settings";
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("recent-destinations");
    recentCount.value = 0;
    resetSettings();
}

function estimateStorageSize(): string {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            const val = localStorage.getItem(key);
            if (val) totalBytes += key.length + val.length;
        }
    }
    if (totalBytes < 1024) return `${totalBytes} B`;
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
}

const mapDataFiles = computed(() => {
    const game = selectedGame.value;
    return [
        { name: "Cities", files: `${game}/map-data/cities.json (${game === "ets2" ? "+ villages" : ""})` },
        { name: "Companies", files: `${game}/map-data/companies.geojson` },
        { name: "Tiles (roads)", files: `${game}/map-data/tiles/roads.mp3` },
        { name: "Tiles (data)", files: `${game}/map-data/tiles/map-data-combined.mp3` },
        { name: "Road Network", files: `${game}/roadnetwork/graph.bin + geometry.bin` },
    ];
});
</script>

<template>
    <div>
        <!-- Storage Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:hard-drive" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Storage
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:database" size="24" />
                <p>localStorage Usage</p>
            </div>
            <span style="font-size: 1.4rem; font-weight: 600; color: #22d3ee; font-family: monospace;">
                {{ estimateStorageSize() }}
            </span>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:history" size="24" />
                <p>Recent Destinations</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.4rem; font-weight: 600; color: #a1a1aa;">
                    {{ recentCount }} / 5
                </span>
                <button
                    v-if="recentCount > 0"
                    @click="clearRecentDestinations"
                    class="nav-btn settings-btn red-color"
                    style="font-size: 1.3rem;"
                >
                    <Icon name="lucide:trash-2" size="16" />
                    Clear
                </button>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:map-pin" size="24" />
                <p>Saved Route</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.3rem; font-weight: 500; color: #a1a1aa; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ savedDest ? `${savedDest[0].toFixed(3)}, ${savedDest[1].toFixed(3)}` : "None" }}
                </span>
                <button
                    v-if="savedDest"
                    @click="clearRouteHistory"
                    class="nav-btn settings-btn red-color"
                    style="font-size: 1.3rem;"
                >
                    <Icon name="lucide:trash-2" size="16" />
                    Clear
                </button>
            </div>
        </div>

        <div class="small-separator"></div>

        <!-- Map Data Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:layers" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Map Data ({{ selectedGame.toUpperCase() }})
                </span>
            </div>
        </div>

        <div v-for="(item, idx) in mapDataFiles" :key="idx" class="option setting">
            <div class="option-title">
                <Icon :name="idx === 4 ? 'lucide:git-branch' : 'lucide:file-json'" size="20" />
                <p style="font-size: 1.5rem;">{{ item.name }}</p>
            </div>
            <span style="font-size: 1.2rem; color: #a1a1aa; text-align: right; max-width: 180px;">
                {{ item.files }}
            </span>
        </div>

        <div class="small-separator"></div>

        <!-- Advanced Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:alert-triangle" size="18" style="color: #f44336;" />
                <span style="font-size: 1.3rem; color: #f44336; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Advanced
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:rotate-ccw" size="24" />
                <p>{{ t("settings.resetToDefaults") }}</p>
            </div>

            <button
                @click.prevent="resetSettings"
                class="nav-btn settings-btn red-color"
            >
                {{ t("common.reset") }}
            </button>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:bomb" size="24" />
                <p>Clear All Data</p>
            </div>

            <button
                @click.prevent="clearAllLocalData"
                class="nav-btn settings-btn red-color"
                style="font-weight: 700;"
            >
                <Icon name="lucide:trash-2" size="16" />
                Clear All
            </button>
        </div>
    </div>
</template>
