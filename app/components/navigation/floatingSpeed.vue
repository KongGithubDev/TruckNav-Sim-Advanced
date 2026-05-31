<script lang="ts" setup>
const props = defineProps<{
    truckSpeed: number;
    speedLimit: number;
}>();

const isSpeeding = computed(() => props.speedLimit > 0 && props.truckSpeed > props.speedLimit);
const displaySpeed = computed(() => Math.round(props.truckSpeed));
const displayLimit = computed(() => Math.round(props.speedLimit));
</script>

<template>
    <Transition name="speed-pop">
        <div class="floating-speed" :class="{ 'is-speeding': isSpeeding }">
            <div class="speed-value">{{ displaySpeed }}</div>
            <div class="speed-unit">km/h</div>
            <div v-if="speedLimit > 0" class="speed-limit-badge" :class="{ 'limit-exceeded': isSpeeding }">
                <span>{{ displayLimit }}</span>
            </div>
        </div>
    </Transition>
</template>

<style lang="scss" scoped>
.floating-speed {
    position: absolute;
    bottom: 120px;
    left: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 72px;
    padding: 10px 0 8px;
    border-radius: 18px;
    background: rgba(20, 28, 38, 0.85);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
    transition: border-color 0.3s, box-shadow 0.3s, background 0.3s;
    pointer-events: none;
    z-index: 100;

    &.is-speeding {
        border-color: rgba(244, 67, 54, 0.7);
        box-shadow: 0 0 20px rgba(244, 67, 54, 0.4), 0 6px 24px rgba(0,0,0,0.4);
    }

    .speed-value {
        font-size: 2.6rem;
        font-weight: 700;
        line-height: 1;
        color: #ffffff;
        letter-spacing: -1px;
        font-variant-numeric: tabular-nums;
        transition: color 0.3s;
    }

    .is-speeding & .speed-value {
        color: #ff5252;
    }

    .speed-unit {
        font-size: 0.72rem;
        color: #8899aa;
        font-weight: 500;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-top: 1px;
    }

    .speed-limit-badge {
        margin-top: 8px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid #dd4a34;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        font-weight: 700;
        color: #111;
        transition: background 0.3s, transform 0.2s;

        &.limit-exceeded {
            background: #f44336;
            color: #fff;
            transform: scale(1.1);
        }
    }
}

.speed-pop-enter-active,
.speed-pop-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}
.speed-pop-enter-from,
.speed-pop-leave-to {
    opacity: 0;
    transform: translateX(-20px) scale(0.9);
}
</style>
