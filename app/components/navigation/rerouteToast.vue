<script lang="ts" setup>
import { useTranslations } from '~/composables/Translations';

const props = defineProps<{
    isCalculating: boolean;
    isRerouting?: boolean;
}>();

const { t } = useTranslations();

// Distinguish between first-time calculation and rerouting
const isActuallyRerouting = computed(() => props.isRerouting === true);
const isVisible = computed(() => props.isCalculating);
</script>

<template>
    <Transition name="toast-slide">
        <div v-if="isVisible" class="reroute-toast glass-panel" :class="{ 'is-rerouting': isActuallyRerouting }">
            <!-- Rerouting pulse ring animation -->
            <div v-if="isActuallyRerouting" class="pulse-ring-container">
                <div class="pulse-ring" />
                <div class="pulse-ring delay-1" />
                <Icon name="lucide:navigation" class="reroute-icon" />
            </div>

            <!-- First-time calculation spinner -->
            <Icon v-else name="svg-spinners:ring-resize" class="spinner" />

            <div class="toast-content">
                <span class="toast-text">
                    {{ isActuallyRerouting ? (t('notifications.rerouting') || 'Rerouting...') : (t('notifications.locatingRoute') || 'Calculating Route...') }}
                </span>
                <span v-if="isActuallyRerouting" class="toast-subtext">
                    {{ t('notifications.reroutingSubtext') || 'Finding new path' }}
                </span>
            </div>
        </div>
    </Transition>
</template>

<style lang="scss" scoped>
.reroute-toast {
    position: absolute;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    border-radius: 30px;
    
    background: rgba(20, 28, 36, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;

    &.is-rerouting {
        background: rgba(15, 22, 32, 0.95);
        border-color: rgba(251, 146, 60, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(251, 146, 60, 0.15);
    }

    .spinner {
        font-size: 22px;
        color: #22d3ee;
        flex-shrink: 0;
    }

    .reroute-icon {
        font-size: 16px;
        color: #fb923c;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
    }

    .toast-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .toast-text {
        color: #fff;
        font-size: 1.4rem;
        font-weight: 600;
        letter-spacing: 0.2px;
        line-height: 1.2;
    }

    .toast-subtext {
        color: rgba(255, 255, 255, 0.5);
        font-size: 1.1rem;
        font-weight: 400;
        letter-spacing: 0.1px;
    }
}

// Pulse ring container
.pulse-ring-container {
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.pulse-ring {
    position: absolute;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid rgba(251, 146, 60, 0.7);
    animation: pulse-expand 1.6s ease-out infinite;

    &.delay-1 {
        animation-delay: 0.8s;
    }
}

@keyframes pulse-expand {
    0% {
        transform: scale(0.5);
        opacity: 1;
    }
    100% {
        transform: scale(1.8);
        opacity: 0;
    }
}

// Slide-in/out transitions
.toast-slide-enter-active {
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.55, 0, 1, 0.45);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
    opacity: 0;
    transform: translate(-50%, -120%) scale(0.85);
}
</style>
