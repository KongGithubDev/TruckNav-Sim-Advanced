<script lang="ts" setup>
import SegmentedControl from "../segmentedControl.vue";

import { useVoiceWarnings } from "~/composables/useVoiceWarnings";

const { activeSettings, updateProfile } = useSettings();
const { t } = useTranslations();
const { availableVoices, loadVoices, testVoice } = useVoiceWarnings();

const voiceOptions = computed(() => {
    return availableVoices.value.map(v => ({
        label: `${v.name} (${v.lang})`,
        value: v.voiceURI
    }));
});

function toggleVoiceWarnings() {
    updateProfile("voiceWarnings", !activeSettings.value.voiceWarnings);
    if (!activeSettings.value.voiceWarnings) {
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
</script>

<template>
    <div>
        <!-- Main toggle -->
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

        <div class="small-separator"></div>

        <!-- Language selector -->
        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:languages" size="24" />
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

        <div class="small-separator"></div>

        <!-- Warning Categories -->
        <div class="voice-categories" style="display: flex; flex-direction: column; gap: 8px; padding: 0 2rem;">
            <!-- Speeding -->
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
        <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 14px; padding-top: 12px; padding: 12px 2rem 0;">
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
                </div>
            </div>
        </div>

        <div class="small-separator"></div>

        <!-- Test voice button -->
        <button
            class="test-voice-btn"
            @click="handleTestVoice"
            style="
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
                margin-left: 2rem;
                width: fit-content;
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
            padding: 0 2rem;
        ">
            <Icon name="lucide:info" size="14" style="vertical-align: middle; margin-right: 4px;" />
            {{ t("settings.voiceNote") }}
        </p>
    </div>
</template>
