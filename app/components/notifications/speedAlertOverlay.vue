<script lang="ts" setup>
const props = defineProps<{
    truckSpeed: number;
    speedLimit: number;
}>();

const { kmToUserUnits, speedUnit } = useUnitConversion();
const { t } = useTranslations();
const { speakWarning } = useVoiceWarnings();

const isSpeeding = ref(false);
const displaySpeed = computed(() => Math.round(kmToUserUnits(props.truckSpeed)));
const displayLimit = computed(() => Math.round(kmToUserUnits(props.speedLimit)));
const unit = computed(() => speedUnit.value);

// Track last spoken time (separate from the speedLimit.vue cooldown)
let lastSpeakTime = 0;

watch(
    // Use 5% buffer (matching speedLimit.vue) to prevent flickering at the threshold
    () => props.speedLimit > 0 && props.truckSpeed > props.speedLimit * 1.05,
    (overLimit) => {
        if (overLimit) {
            if (!isSpeeding.value) {
                // Just crossed the limit — trigger alert entry
                isSpeeding.value = true;
                
                // Speak detailed warning with actual values (15s cooldown)
                const now = Date.now();
                if (now - lastSpeakTime > 15000) {
                    const limit = displayLimit.value;
                    const speed = displaySpeed.value;
                    const u = unit.value;
                    speakWarning(
                        'speeding',
                        t('warnings.speedLimitExceeded') + `. Limit ${limit} ${u}, you are driving ${speed}.`,
                        15
                    );
                    lastSpeakTime = now;
                }
            }
        } else {
            isSpeeding.value = false;
        }
    },
);

// Also speak when speed increases significantly while already speeding
watch(
    () => Math.round(props.truckSpeed / 5) * 5, // every 5 km/h increment
    (speedBucket) => {
        if (!isSpeeding.value || props.speedLimit <= 0) return;
        if (speedBucket <= props.speedLimit) return;
        
        const now = Date.now();
        if (now - lastSpeakTime > 20000) {
            const limit = displayLimit.value;
            const speed = displaySpeed.value;
            const u = unit.value;
            speakWarning(
                'speeding',
                `${t('warnings.speedLimitExceeded')}. Limit ${limit} ${u}, you are driving ${speed}.`,
                20
            );
            lastSpeakTime = now;
        }
    },
);
</script>

<template>
    <Transition name="speed-alert-slide">
        <div v-if="isSpeeding" class="speed-alert-overlay">
            <div class="speed-alert-content">
                <div class="alert-left">
                    <Icon name="lucide:alert-triangle" size="16" class="alert-icon" />
                    <span class="alert-label">{{ t('common.speeding') }}</span>
                </div>
                <div class="alert-right">
                    <span class="alert-speed">{{ displaySpeed }}</span>
                    <span class="alert-unit">{{ unit }}</span>
                    <span class="alert-separator">/</span>
                    <span class="alert-limit">{{ displayLimit }}</span>
                    <span class="alert-unit">{{ unit }}</span>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.speed-alert-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999;
    pointer-events: none;
    animation: pulse-bg 1.2s ease-in-out infinite;
}

.speed-alert-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.92), rgba(198, 40, 40, 0.92));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    min-height: 40px;
}

.alert-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.alert-icon {
    color: #fff;
    animation: icon-bounce 0.6s ease-in-out infinite alternate;
}

.alert-label {
    color: #fff;
    font-size: 1.3rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.alert-right {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-variant-numeric: tabular-nums;
}

.alert-speed {
    color: #fff;
    font-size: 1.6rem;
    font-weight: 800;
}

.alert-unit {
    color: rgba(255, 255, 255, 0.7);
    font-size: 1rem;
    font-weight: 600;
}

.alert-separator {
    color: rgba(255, 255, 255, 0.4);
    font-size: 1.2rem;
    margin: 0 2px;
}

.alert-limit {
    color: rgba(255, 255, 255, 0.8);
    font-size: 1.3rem;
    font-weight: 700;
}

@keyframes pulse-bg {
    0% {
        opacity: 1;
    }
    50% {
        opacity: 0.85;
    }
    100% {
        opacity: 1;
    }
}

@keyframes icon-bounce {
    0% {
        transform: translateY(0);
    }
    100% {
        transform: translateY(-2px);
    }
}

.speed-alert-slide-enter-active {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
}
.speed-alert-slide-leave-active {
    transition: transform 0.25s ease, opacity 0.2s ease;
}
.speed-alert-slide-enter-from {
    transform: translateY(-100%);
    opacity: 0;
}
.speed-alert-slide-leave-to {
    transform: translateY(-100%);
    opacity: 0;
}
</style>
