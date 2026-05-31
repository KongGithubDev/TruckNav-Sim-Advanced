<script lang="ts" setup>
import { useTrafficData } from '~/composables/useTrafficData';

const { routeTrafficInfo, trafficEnabled } = useTrafficData();
</script>

<template>
    <div v-if="trafficEnabled && routeTrafficInfo && routeTrafficInfo.routeColors.length > 0" class="traffic-progress-container glass-panel">
        <div class="traffic-bar">
            <div 
                v-for="(color, index) in routeTrafficInfo.routeColors" 
                :key="index"
                class="traffic-segment"
                :style="{ backgroundColor: color }"
            ></div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.traffic-progress-container {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    max-width: 600px;
    padding: 8px 12px;
    border-radius: 12px;
    z-index: 1000;

    &.glass-panel {
        background: rgba(34, 46, 60, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .traffic-bar {
        display: flex;
        width: 100%;
        height: 8px;
        border-radius: 4px;
        overflow: hidden;

        .traffic-segment {
            flex: 1;
            height: 100%;
            // Add slight transition if colors update
            transition: background-color 0.5s ease;
        }
    }
}
</style>
