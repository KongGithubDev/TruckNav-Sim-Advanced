<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useCitySearch } from '~/composables/useCitySearch';
import type { CityData } from '~/composables/useCitySearch';

const props = defineProps<{
    truckCoords: [number, number] | null;
}>();

const { getClosestCity, loadCities, isLoaded } = useCitySearch();
const currentCity = ref<CityData | null>(null);

onMounted(() => {
    loadCities();
});

// Update every few seconds or when coords change significantly to avoid too much calculation
watch(() => props.truckCoords, (coords) => {
    if (!isLoaded.value || !coords) return;
    
    // Simple throttle: only recalculate if we haven't done it this frame or similar,
    // but Vue's reactivity might trigger often. We'll rely on it for now.
    const city = getClosestCity(coords[0], coords[1]);
    if (city) {
        currentCity.value = city;
    }
}, { immediate: true });

</script>

<template>
    <div v-if="currentCity" class="current-location-hud glass-panel">
        <Icon name="lucide:map-pin" class="pin-icon" />
        <div class="location-text">
            <span class="city">{{ currentCity.name }}</span>
            <span class="country">{{ currentCity.countryToken.toUpperCase() }}</span>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.current-location-hud {
    position: absolute;
    bottom: 75px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    padding: 8px 16px;
    border-radius: 20px;
    
    &.glass-panel {
        background: rgba(34, 46, 60, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .pin-icon {
        color: #22d3ee;
        font-size: 20px;
        margin-right: 10px;
    }

    .location-text {
        display: flex;
        align-items: baseline;
        gap: 6px;

        .city {
            color: #fff;
            font-size: 1.4rem;
            font-weight: 600;
        }

        .country {
            color: #a1a1aa;
            font-size: 1.1rem;
        }
    }
}
</style>
