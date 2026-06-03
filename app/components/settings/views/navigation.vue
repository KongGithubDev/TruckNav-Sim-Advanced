<script lang="ts" setup>
import SegmentedControl from "../segmentedControl.vue";

const { settings, activeSettings, updateProfile } = useSettings();
const { t } = useTranslations();

const hasGuidedNavigation = computed(
    () => activeSettings.value.hasTurnNavigation === true,
);

interface TMPServer {
    id: number;
    map: number;
    name: string;
    game: string;
}

const serverOptions = ref<{ label: string; value: number }[]>([]);

onMounted(async () => {
    try {
        const res = await fetch("https://truckersmp.krashnz.com/servers");
        if (res.ok) {
            const data = await res.json();
            if (data && data.servers) {
                const game = settings.value.selectedGame;
                const filtered = data.servers.filter((s: TMPServer) => 
                    game === 'ets2' ? (s.game === 'ets2' || s.game === 'promods') : s.game === 'ats'
                );
                
                serverOptions.value = filtered.map((s: TMPServer) => ({
                    label: s.name,
                    value: s.map
                }));
            }
        }
    } catch (e) {
        console.error("Failed to load TMP servers", e);
    }
});

function toggleGuidedNavigation() {
    updateProfile("hasTurnNavigation", !hasGuidedNavigation.value);
}

function toggleAutoFollow() {
    updateProfile("autoFollowEnabled", !activeSettings.value.autoFollowEnabled);
}

function toggle3DMode() {
    updateProfile("enable3DMode", !activeSettings.value.enable3DMode);
}

function toggleTraffic() {
    updateProfile("showTraffic", !activeSettings.value.showTraffic);
}

function updateTrafficServer(val: number) {
    updateProfile("trafficServerId", val);
}

function togglePoiCategory(key: "showPoiGas" | "showPoiService" | "showPoiDealers" | "showPoiOther") {
    updateProfile(key, !activeSettings.value[key]);
}

function toggleCityLabels() {
    updateProfile("showCityLabels", !activeSettings.value.showCityLabels);
}

function setRouteType(val: "fastest" | "shortest") {
    updateProfile("routeType", val);
}

function toggleAvoidFerries() {
    updateProfile("avoidFerries", !activeSettings.value.avoidFerries);
}
</script>

<template>
    <div>
        <!-- Navigation Mode Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:navigation" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    {{ t("settings.navigation") }}
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:navigation-2" size="24" />
                <p>{{ t("settings.guidedNavigation") }}</p>
            </div>

            <SegmentedControl
                :left-option="t('settings.on')"
                :right-option="t('settings.off')"
                @connect="toggleGuidedNavigation"
                size="normal"
                :active="hasGuidedNavigation"
            />
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:locate-fixed" size="24" />
                <p>{{ t("settings.autoFollowMode") || "Auto-Follow Mode" }}</p>
            </div>

            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggleAutoFollow"
                :active="!activeSettings.autoFollowEnabled"
                size="normal"
            />
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:box" size="24" />
                <p>{{ t("settings.enable3DMode") || "3D Map Mode" }}</p>
            </div>

            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggle3DMode"
                :active="!activeSettings.enable3DMode"
                size="normal"
            />
        </div>

        <div class="small-separator"></div>

        <!-- Auto-Zoom Section -->
        <div class="option setting" style="flex-direction: column; align-items: stretch; padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <Icon name="lucide:search" size="16" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    {{ t("settings.turnZoom") || "Auto-Zoom Distance" }}
                </span>
            </div>

            <div class="voice-distance-slider">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 1.3rem; color: #d4d4d8;">🔍 {{ t("settings.turnZoomDesc") || "Zoom when turn <" }}</span>
                    <span style="font-size: 1.3rem; color: #22d3ee; font-weight: 600;">{{ (activeSettings.turnZoomKm ?? 0.8) * 1000 }} m</span>
                </div>
                <input
                    type="range"
                    min="0.05"
                    max="3"
                    step="0.05"
                    :value="activeSettings.turnZoomKm ?? 0.8"
                    @input="(e: any) => updateProfile('turnZoomKm', parseFloat(e.target.value))"
                    style="width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 3px; outline: none; cursor: pointer;"
                />
                <div style="display: flex; justify-content: space-between; font-size: 1rem; color: #666; margin-top: 2px;">
                    <span>50 m</span>
                    <span>3 km</span>
                </div>
            </div>
        </div>

        <div class="small-separator"></div>

        <!-- Route Preferences Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:route" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Route Preferences
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:gauge" size="24" />
                <p>{{ t("settings.routeType") || "Route Type" }}</p>
            </div>

            <USelect
                :model-value="activeSettings.routeType"
                @update:model-value="(val: any) => setRouteType(val)"
                :items="[
                    { label: t('settings.routeTypeFastest') || 'Fastest', value: 'fastest' },
                    { label: t('settings.routeTypeShortest') || 'Shortest', value: 'shortest' },
                ]"
                variant="none"
                class="selector"
                value-attribute="value"
                option-attribute="label"
                :ui="{
                    trailingIcon: 'shrink-0 size-[20px] text-white !px-6',
                    content: 'bg-[#222e3c] shadow-xl rounded-md',
                    item: 'flex items-center justify-between text-[1.6rem] font-BOLD !py-2 !px-3 text-[#f2f2f2] data-[highlighted]:bg-[#3d546e] rounded cursor-pointer transition-colors',
                    itemTrailingIcon: 'text-white',
                }"
            />
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:ship" size="24" />
                <p>{{ t("settings.avoidFerries") || "Avoid Ferries" }}</p>
            </div>
            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggleAvoidFerries"
                :active="!activeSettings.avoidFerries"
                size="normal"
            />
        </div>

        <div class="small-separator"></div>

        <!-- Traffic Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:traffic-cone" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Traffic
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:traffic-cone" size="24" />
                <p>{{ t("settings.traffic") }}</p>
            </div>

            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggleTraffic"
                :active="!activeSettings.showTraffic"
                size="normal"
            />
        </div>

        <Transition name="fade-collapse">
            <div v-if="activeSettings.showTraffic" class="option setting" style="margin-top: 10px;">
                <div class="option-title" style="margin-left: 30px;">
                    <Icon name="lucide:server" size="24" />
                    <p>{{ t("settings.trafficServer") || "Server" }}</p>
                </div>

                <USelect
                    :model-value="activeSettings.trafficServerId"
                    @update:model-value="(val: number) => updateTrafficServer(Number(val))"
                    :items="serverOptions"
                    variant="none"
                    class="selector"
                    value-attribute="value"
                    option-attribute="label"
                    :ui="{
                        trailingIcon: 'shrink-0 size-[20px] text-white !px-6',
                        content: 'bg-[#222e3c] shadow-xl rounded-md',
                        item: 'flex items-center justify-between text-[1.6rem] font-BOLD !py-2 !px-3 text-[#f2f2f2] data-[highlighted]:bg-[#3d546e] rounded cursor-pointer transition-colors',
                        itemTrailingIcon: 'text-white',
                    }"
                />
            </div>
        </Transition>

<div class="small-separator"></div>

        <!-- Map Display Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:layout-dashboard" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Map Display
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:map-pin" size="24" />
                <p>{{ t("settings.showPoiIcons") || "POI Icons" }}</p>
            </div>
        </div>

        <div class="option setting" style="margin-top: 4px;">
            <div class="option-title" style="margin-left: 30px;">
                <Icon name="lucide:fuel" size="20" />
                <p style="font-size: 1.3rem;">{{ t("settings.showPoiGas") || "Gas Stations" }}</p>
            </div>
            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="() => togglePoiCategory('showPoiGas')"
                :active="!activeSettings.showPoiGas"
                size="small"
            />
        </div>

        <div class="option setting">
            <div class="option-title" style="margin-left: 30px;">
                <Icon name="lucide:wrench" size="20" />
                <p style="font-size: 1.3rem;">{{ t("settings.showPoiService") || "Service / Repair" }}</p>
            </div>
            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="() => togglePoiCategory('showPoiService')"
                :active="!activeSettings.showPoiService"
                size="small"
            />
        </div>

        <div class="option setting">
            <div class="option-title" style="margin-left: 30px;">
                <Icon name="lucide:warehouse" size="20" />
                <p style="font-size: 1.3rem;">{{ t("settings.showPoiDealers") || "Truck Dealers" }}</p>
            </div>
            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="() => togglePoiCategory('showPoiDealers')"
                :active="!activeSettings.showPoiDealers"
                size="small"
            />
        </div>

        <div class="option setting">
            <div class="option-title" style="margin-left: 30px;">
                <Icon name="lucide:layers" size="20" />
                <p style="font-size: 1.3rem;">{{ t("settings.showPoiOther") || "Other (Parking, Garages, ...)" }}</p>
            </div>
            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="() => togglePoiCategory('showPoiOther')"
                :active="!activeSettings.showPoiOther"
                size="small"
            />
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:square-gantt" size="24" />
                <p>{{ t("settings.showCityLabels") || "City Labels" }}</p>
            </div>

            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggleCityLabels"
                :active="!activeSettings.showCityLabels"
                size="normal"
            />
        </div>
    </div>
</template>
