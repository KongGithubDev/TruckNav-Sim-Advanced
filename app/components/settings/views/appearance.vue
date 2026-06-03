<script lang="ts" setup>
import { generateTruckIcon } from "~/assets/utils/map/markers";
import SegmentedControl from "../segmentedControl.vue";

import { useVoiceWarnings } from "~/composables/useVoiceWarnings";

const { settings, activeSettings, updateProfile, DEFAULT_SETTINGS } =
    useSettings();
const { t } = useTranslations();
const { availableVoices, loadVoices, testVoice } = useVoiceWarnings();

const voiceOptions = computed(() => {
    return availableVoices.value.map(v => ({
        label: `${v.name} (${v.lang})`,
        value: v.voiceURI
    }));
});

const truckImgSrc = ref("");
const isDriveInfoOpened = ref(false);

const isTextThemeLight = computed(
    () => activeSettings.value.textColor === "light",
);

const items = ref([
    "Quicksand",
    "Roboto",
    "Exo-2",
    "Montserrat",
    "Oxanium",
    "Rubik",
    "Open-Sans",
    "Nunito",
    "Karla",
    "Commissioner",
]);

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
                // Filter servers based on the current game (ets2 includes promods)
                const game = settings.value.selectedGame;
                const filtered = data.servers.filter((s: TMPServer) => 
                    game === 'ets2' ? (s.game === 'ets2' || s.game === 'promods') : s.game === 'ats'
                );
                
                serverOptions.value = filtered.map((s: TMPServer) => ({
                    label: s.name,
                    value: s.map // The 'map' property is what ets2map tracker uses as server id
                }));
            }
        }
    } catch (e) {
        console.error("Failed to load TMP servers", e);
    }
});

async function updatePreviewIcon() {
    const img = await generateTruckIcon(activeSettings.value.themeColor);
    truckImgSrc.value = img.src;
}

function toggleTextColor() {
    updateProfile("textColor", isTextThemeLight.value ? "dark" : "light");
}

function toggleTraffic() {
    updateProfile("showTraffic", !activeSettings.value.showTraffic);
}

function updateTrafficServer(val: number) {
    updateProfile("trafficServerId", val);
}

function updateFont(val: string) {
    updateProfile("fontFamily", val);
}

function toggleDriveInfoPanel() {
    isDriveInfoOpened.value = !isDriveInfoOpened.value;
}

function toggleAutoDayNight() {
    updateProfile("autoDayNightTheme", !activeSettings.value.autoDayNightTheme);
}

function toggleVoiceWarnings() {
    updateProfile("voiceWarnings", !activeSettings.value.voiceWarnings);
    if (!activeSettings.value.voiceWarnings) {
        // Just turned ON, try to load voices
        loadVoices();
    }
}

function updateVoiceLanguage(val: string) {
    updateProfile("voiceLanguage", val);
}

function toggleVoiceCategory(category: string, enabled: boolean) {
    const categories = { ...activeSettings.value.voiceWarningCategories, [category]: enabled };
    updateProfile("voiceWarningCategories", categories);
}

function handleTestVoice() {
    loadVoices();
    setTimeout(() => testVoice(), 200);
}

watch(() => activeSettings.value.themeColor, updatePreviewIcon, {
    immediate: true,
});
</script>

<template>
    <div>
        <ColorOption
            :option-title="t('settings.theme')"
            color-element="themeColor"
        >
            <template #icon>
                <Icon name="lucide:palette" size="24" />
            </template>
        </ColorOption>

        <ColorOption
            :option-title="t('settings.route')"
            color-element="routeColor"
        >
            <template #icon>
                <Icon name="lucide:route" size="24" />
            </template>
        </ColorOption>

        <div class="small-separator"></div>

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

        <Transition name="fade-collapse">
            <div v-if="!activeSettings.autoDayNightTheme" class="option setting">
                <div class="option-title">
                    <Icon name="lucide:type-outline" size="24" />
                    <p>{{ t("settings.textTheme") }}</p>
                </div>

                <SegmentedControl
                    :left-option="t('settings.light')"
                    :right-option="t('settings.dark')"
                    :is-same-color="true"
                    @connect="toggleTextColor"
                    :active="isTextThemeLight"
                    size="normal"
                />
            </div>
            <div v-else class="option setting">
                <div class="option-title">
                    <Icon name="lucide:type-outline" size="24" />
                    <p>{{ t("settings.textTheme") }} <span style="font-size: 1.2rem; color: #a1a1aa;">(Auto)</span></p>
                </div>
            </div>
        </Transition>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:moon-star" size="24" />
                <p>Auto Day/Night Theme</p>
            </div>

            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggleAutoDayNight"
                :active="!activeSettings.autoDayNightTheme"
                size="normal"
            />
        </div>

        <div class="small-separator"></div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:volume-2" size="24" />
                <p>Voice Warnings</p>
            </div>

            <SegmentedControl
                :left-option="t('common.off')"
                :right-option="t('common.on')"
                :is-same-color="true"
                @connect="toggleVoiceWarnings"
                :active="!activeSettings.voiceWarnings"
                size="normal"
            />
        </div>

        <Transition name="fade-collapse">
            <div v-if="activeSettings.voiceWarnings" class="voice-options" style="margin-top: 10px; margin-left: 30px;">
                <!-- Language selector -->
                <div class="option setting" style="margin-bottom: 12px;">
                    <div class="option-title">
                        <Icon name="lucide:languages" size="20" />
                        <p>{{ t("settings.voiceLanguage") || "Voice Language" }}</p>
                    </div>

                    <USelect
                        :model-value="activeSettings.voiceLanguage"
                        @update:model-value="(val: string) => updateVoiceLanguage(val)"
                        :items="voiceOptions"
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

                <!-- Warning type toggles -->
                <div class="voice-categories" style="display: flex; flex-direction: column; gap: 8px;">
                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.speeding ?? true"
                            @change="(e: any) => toggleVoiceCategory('speeding', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:alert-triangle" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceSpeeding") || "Speeding" }}</span>
                    </label>

                    <!-- Turn Guidance Section Header -->
                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0 4px 0; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px;">
                        <Icon name="lucide:navigation" size="16" style="color: #a1a1aa;" />
                        <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600;">
                            {{ t("settings.voiceTurnGuidance") || "Turn Guidance" }}
                        </span>
                    </div>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.turn_5km ?? true"
                            @change="(e: any) => toggleVoiceCategory('turn_5km', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:arrow-right-circle" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceTurn5km") || "Turn (5 km)" }}</span>
                    </label>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.turn_2km ?? true"
                            @change="(e: any) => toggleVoiceCategory('turn_2km', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:arrow-right" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceTurn2km") || "Turn (2 km)" }}</span>
                    </label>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.turn_1km ?? true"
                            @change="(e: any) => toggleVoiceCategory('turn_1km', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:corner-down-right" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceTurn1km") || "Turn (1 km)" }}</span>
                    </label>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.turn_500m ?? true"
                            @change="(e: any) => toggleVoiceCategory('turn_500m', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:corner-down-right" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceTurn500m") || "Turn (500 m)" }}</span>
                    </label>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.turn_now ?? true"
                            @change="(e: any) => toggleVoiceCategory('turn_now', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:corner-right-up" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceTurnNow") || "Turn (final)" }}</span>
                    </label>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.traffic_ahead ?? true"
                            @change="(e: any) => toggleVoiceCategory('traffic_ahead', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:car" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceTraffic") || "Traffic Alert" }}</span>
                    </label>

                    <!-- Long Straight Section Header -->
                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0 4px 0; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px;">
                        <Icon name="lucide:arrow-up" size="16" style="color: #a1a1aa;" />
                        <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600;">
                            {{ t("settings.voiceStraightSection") || "Long Straight" }}
                        </span>
                    </div>

                    <label class="voice-category-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                        <input
                            type="checkbox"
                            :checked="activeSettings.voiceWarningCategories?.straight_long ?? true"
                            @change="(e: any) => toggleVoiceCategory('straight_long', e.target.checked)"
                            style="width: 18px; height: 18px; accent-color: var(--theme-color); cursor: pointer;"
                        />
                        <Icon name="lucide:arrow-up" size="18" />
                        <span style="font-size: 1.4rem;">{{ t("settings.voiceStraightLong") || "Straight (10+ km)" }}</span>
                    </label>
                </div>

                <!-- Voice distance sliders -->
                <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 14px; padding-top: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <Icon name="lucide:sliders-horizontal" size="16" style="color: #a1a1aa;" />
                        <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600;">
                            {{ t("settings.voiceDistances") || "Voice Distances" }}
                        </span>
                    </div>

                    <!-- 5km slider -->
                    <div class="voice-distance-slider" style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 1.3rem; color: #d4d4d8;">🔄 {{ t("settings.voiceTurn5km") || "Turn (5 km)" }}</span>
                            <span style="font-size: 1.3rem; color: #22d3ee; font-weight: 600;">{{ activeSettings.voiceWarningDistances?.turn5kmStart ?? 6 }} km</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="20"
                            step="0.5"
                            :value="activeSettings.voiceWarningDistances?.turn5kmStart ?? 6"
                            @input="(e: any) => {
                                const dist = { ...activeSettings.voiceWarningDistances, turn5kmStart: parseFloat(e.target.value) };
                                updateProfile('voiceWarningDistances', dist);
                            }"
                            style="width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 3px; outline: none; cursor: pointer;"
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 1rem; color: #666; margin-top: 2px;">
                            <span>2 km</span>
                            <span>20 km</span>
                        </div>
                    </div>

                    <!-- 2km slider -->
                    <div class="voice-distance-slider" style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 1.3rem; color: #d4d4d8;">➡️ {{ t("settings.voiceTurn2km") || "Turn (2 km)" }}</span>
                            <span style="font-size: 1.3rem; color: #22d3ee; font-weight: 600;">{{ activeSettings.voiceWarningDistances?.turn2kmStart ?? 1.5 }} km</span>
                        </div>
                        <input
                            type="range"
                            min="0.3"
                            max="5"
                            step="0.1"
                            :value="activeSettings.voiceWarningDistances?.turn2kmStart ?? 1.5"
                            @input="(e: any) => {
                                const dist = { ...activeSettings.voiceWarningDistances, turn2kmStart: parseFloat(e.target.value) };
                                updateProfile('voiceWarningDistances', dist);
                            }"
                            style="width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 3px; outline: none; cursor: pointer;"
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 1rem; color: #666; margin-top: 2px;">
                            <span>0.3 km</span>
                            <span>5 km</span>
                        </div>
                    </div>

                    <!-- 500m slider -->
                    <div class="voice-distance-slider" style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 1.3rem; color: #d4d4d8;">↘️ {{ t("settings.voiceTurn500m") || "Turn (500 m)" }}</span>
                            <span style="font-size: 1.3rem; color: #22d3ee; font-weight: 600;">{{ (activeSettings.voiceWarningDistances?.turn500mStart ?? 0.3) * 1000 }} m</span>
                        </div>
                        <input
                            type="range"
                            min="0.05"
                            max="1"
                            step="0.01"
                            :value="activeSettings.voiceWarningDistances?.turn500mStart ?? 0.3"
                            @input="(e: any) => {
                                const dist = { ...activeSettings.voiceWarningDistances, turn500mStart: parseFloat(e.target.value) };
                                updateProfile('voiceWarningDistances', dist);
                            }"
                            style="width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 3px; outline: none; cursor: pointer;"
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 1rem; color: #666; margin-top: 2px;">
                            <span>50 m</span>
                            <span>1 km</span>
                        </div>
                    </div>

                    <!-- Now slider -->
                    <div class="voice-distance-slider" style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 1.3rem; color: #d4d4d8;">🔽 {{ t("settings.voiceTurnNow") || "Turn (final)" }}</span>
                            <span style="font-size: 1.3rem; color: #22d3ee; font-weight: 600;">{{ Math.round((activeSettings.voiceWarningDistances?.turnNowStart ?? 0.08) * 1000) }} m</span>
                        </div>
                        <input
                            type="range"
                            min="0.01"
                            max="0.2"
                            step="0.005"
                            :value="activeSettings.voiceWarningDistances?.turnNowStart ?? 0.08"
                            @input="(e: any) => {
                                const dist = { ...activeSettings.voiceWarningDistances, turnNowStart: parseFloat(e.target.value) };
                                updateProfile('voiceWarningDistances', dist);
                            }"
                            style="width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 3px; outline: none; cursor: pointer;"
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 1rem; color: #666; margin-top: 2px;">
                            <span>10 m</span>
                            <span>200 m</span>
                        </div>
                    </div>

                    <!-- Straight long slider -->
                    <div class="voice-distance-slider">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 1.3rem; color: #d4d4d8;">⬆️ {{ t("settings.voiceStraightLong") || "Straight (10+ km)" }}</span>
                            <span style="font-size: 1.3rem; color: #22d3ee; font-weight: 600;">{{ activeSettings.voiceWarningDistances?.straightLongStart ?? 10 }} km</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="50"
                            step="1"
                            :value="activeSettings.voiceWarningDistances?.straightLongStart ?? 10"
                            @input="(e: any) => {
                                const dist = { ...activeSettings.voiceWarningDistances, straightLongStart: parseFloat(e.target.value) };
                                updateProfile('voiceWarningDistances', dist);
                            }"
                            style="width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 3px; outline: none; cursor: pointer;"
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 1rem; color: #666; margin-top: 2px;">
                            <span>2 km</span>
                            <span>50 km</span>
                        </div>                </div>
            </div>
        </Transition>

        <!-- Turn Zoom Distance (always visible, not voice-dependent) -->
        <div style="margin-top: 14px; padding-top: 12px; margin-left: 30px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <Icon name="lucide:search" size="16" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600;">
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

        <!-- Test voice button -->
        <button
            class="test-voice-btn"
            @click="handleTestVoice"
            style="
                margin-top: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: var(--theme-color);
                color: #fff;
                border: none;
                border-radius: 8px;
                font-size: 1.3rem;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.2s;
            "
        >
            <Icon name="lucide:volume-2" size="18" />
            {{ t("settings.testVoice") || "Test Voice" }}
        </button>

        <!-- Voice language note -->
        <p style="
            margin-top: 12px;
            font-size: 1.2rem;
            color: #a1a1aa;
            line-height: 1.6;
        ">
            <Icon name="lucide:info" size="14" style="vertical-align: middle; margin-right: 4px;" />
            {{ t("settings.voiceNote") }}
        </p>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:type" size="24" />
                <p>{{ t("settings.appFont") }}</p>
            </div>

            <USelect
                :model-value="activeSettings.fontFamily"
                @update:model-value="(val: string) => updateFont(val)"
                :items="items"
                variant="none"
                class="selector"
                :ui="{
                    trailingIcon: 'shrink-0 size-[20px] text-white !px-6',
                    content: 'bg-[#222e3c] shadow-xl rounded-md',
                    item: 'flex items-center justify-between text-[1.6rem] font-BOLD !py-2 !px-3 text-[#f2f2f2] data-[highlighted]:bg-[#3d546e] rounded cursor-pointer transition-colors',
                    itemTrailingIcon: 'text-white',
                }"
            >
                <template #item="{ item }">
                    <span :style="{ fontFamily: item }">
                        {{ item }}
                    </span>
                </template>
            </USelect>
        </div>

        <div class="small-separator"></div>

        <IncreaseOption
            :option-title="t('settings.hudButtonSize')"
            setting-name="hudBtnSize"
            :max-value="40"
            :min-value="20"
            :amount="1"
        >
            <template #icon>
                <Icon name="lucide:square-plus" size="24" />
            </template>
        </IncreaseOption>

        <PreviewSetting :height="70">
            <HudButton v-on:click="null">
                <Icon name="lucide:star" class="icon" />
            </HudButton>
        </PreviewSetting>

        <IncreaseOption
            :option-title="t('settings.truckMarkerSize')"
            setting-name="truckMarkerSize"
            :max-value="70"
            :min-value="25"
            :amount="1"
        >
            <template #icon>
                <Icon name="lucide:map-pin-plus" size="24" />
            </template>
        </IncreaseOption>

        <PreviewSetting :height="70">
            <div
                class="actual-truck-preview"
                :style="{
                    width: settings.truckMarkerSize + 'px',
                    height: settings.truckMarkerSize + 'px',
                    backgroundImage: `url('${truckImgSrc}')`,
                }"
            ></div>
        </PreviewSetting>

        <IncreaseOption
            :option-title="t('settings.compactTripSize')"
            setting-name="compactTripFontSize"
            :max-value="2.5"
            :min-value="1.2"
            :amount="0.1"
        >
            <template #icon>
                <Icon name="lucide:circle-plus" size="24" />
            </template>
        </IncreaseOption>

        <PreviewSetting :height="100">
            <CompactTrip
                class="compact-trip-progress preview"
                :route-distance-converted="999"
                distance-unit="mi"
                route-eta="9h 59min"
                arrival-time="20:00"
            />
        </PreviewSetting>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:circle-gauge" size="24" />
                <p>{{ t("settings.drivingInfo") }}</p>
            </div>
            <div class="owned-dlcs">
                <button
                    @click.prevent="toggleDriveInfoPanel"
                    class="nav-btn settings-btn"
                >
                    {{ settings.activeUiComponents.length }} /
                    {{ DEFAULT_SETTINGS.activeUiComponents.length }}
                    {{ t("common.active") }}
                </button>
            </div>
        </div>

        <Transition name="panel-pop">
            <PopupPanel
                v-if="isDriveInfoOpened"
                :title="t('settings.selectComponents')"
                @close="toggleDriveInfoPanel"
            >
                <ManageDriveInfoPanel />
            </PopupPanel>
        </Transition>
    </div>
</template>
