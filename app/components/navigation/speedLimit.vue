<script lang="ts" setup>
import { useVoiceWarnings } from "~/composables/useVoiceWarnings";

const props = defineProps<{
    truckSpeed: number;
    speedLimit: number;
}>();

const { kmToUserUnits } = useUnitConversion();
const { settings } = useSettings();

const truckSpeedConverted = computed(() => kmToUserUnits(props.truckSpeed));
const speedLimitConverted = computed(() => kmToUserUnits(props.speedLimit));

const { speakWarning } = useVoiceWarnings();
const { t } = useTranslations();

watch(
    () => props.truckSpeed > props.speedLimit * 1.05 && props.speedLimit > 0,
    (isSpeeding) => {
        if (isSpeeding) {
            // Speak a warning (with 15s cooldown)
            // It will only speak if voiceWarnings setting is on
            speakWarning(
                'speeding',
                t('warnings.speedLimitExceeded') || 'Warning, speed limit exceeded',
                15
            );
        }
    }
);
</script>

<template>
    <div
        v-if="speedLimit !== 0"
        class="speed-limit-sign"
        :class="settings.selectedGame === 'ets2' ? 'circle' : 'square'"
    >
        <Transition name="over-limit">
            <div
                v-if="truckSpeed > speedLimit * 1.05"
                class="speed-limit-over-limit"
                :class="settings.selectedGame === 'ets2' ? 'circle' : 'square'"
            >
                <div class="over-limit">{{ truckSpeedConverted }}</div>
            </div>
        </Transition>

        <div class="speed-limit">
            {{ speedLimitConverted }}
        </div>
    </div>
</template>

<style
    lang="scss"
    scoped
    src="~/assets/scss/scoped/navigation/speedLimit.scss"
></style>
