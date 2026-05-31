<script lang="ts" setup>
import { computed } from 'vue';
import { useRouteController } from '~/composables/RouteController';

const props = defineProps<{
    isFollowingTruck: boolean;
    hasRoute: boolean;
    truckHeading: number;
    mapBearing: number;
}>();

const emit = defineEmits<{
    (e: 'recenter'): void;
    (e: 'overview'): void;
    (e: 'resetCompass'): void;
}>();

const compassRotation = computed(() => {
    // Map bearing is 0 when North is up. If bearing is 45, the map is rotated 45deg counter-clockwise,
    // so we rotate the compass needle 45deg clockwise to point North.
    return `rotate(${-props.mapBearing}deg)`;
});

</script>

<template>
    <div class="map-controls-container">
        <button 
            v-if="hasRoute"
            class="control-btn glass-panel"
            title="Route Overview"
            @click="emit('overview')"
        >
            <Icon name="lucide:route" />
        </button>

        <button 
            class="control-btn glass-panel compass-btn"
            title="Reset Compass"
            @click="emit('resetCompass')"
        >
            <Icon name="lucide:navigation" class="compass-icon" :style="{ transform: compassRotation }" />
        </button>

        <button 
            class="control-btn glass-panel recenter-btn"
            :class="{ 'is-following': isFollowingTruck }"
            title="Re-center to Truck"
            @click="emit('recenter')"
        >
            <Icon name="lucide:crosshair" />
        </button>
    </div>
</template>

<style lang="scss" scoped>
.map-controls-container {
    position: absolute;
    bottom: 120px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 1000;

    .control-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        transition: all 0.2s ease;
        
        &.glass-panel {
            background: rgba(34, 46, 60, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        &:hover {
            background: rgba(45, 60, 78, 0.9);
            transform: scale(1.05);
        }

        &:active {
            transform: scale(0.95);
        }

        &.recenter-btn {
            &.is-following {
                color: #22d3ee; // Cyan when locked
            }
        }

        .compass-icon {
            transition: transform 0.1s linear;
        }
    }
}
</style>
