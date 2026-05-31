<script lang="ts" setup>
import { useTranslations } from '~/composables/Translations';

defineProps<{
    isCalculating: boolean;
}>();

const { t } = useTranslations();
</script>

<template>
    <Transition name="toast-slide">
        <div v-if="isCalculating" class="reroute-toast glass-panel">
            <Icon name="svg-spinners:ring-resize" class="spinner" />
            <span class="toast-text">{{ t('notifications.locatingRoute') || 'Rerouting...' }}</span>
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
    
    background: rgba(20, 28, 36, 0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    .spinner {
        font-size: 20px;
        color: #22d3ee;
    }

    .toast-text {
        color: #fff;
        font-size: 1.4rem;
        font-weight: 600;
        letter-spacing: 0.2px;
    }
}

.toast-slide-enter-active,
.toast-slide-leave-active {
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
    opacity: 0;
    transform: translate(-50%, -100%);
}
</style>
