<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useCitySearch } from '~/composables/useCitySearch';
import type { CityData } from '~/composables/useCitySearch';
import { convertGeoToEts2, convertGeoToAts } from '~/assets/utils/map/converters';
import { useSettings } from '~/composables/Settings';

const props = defineProps<{
    truckCoords: [number, number] | null;
}>();

const { getClosestCity, loadCities, isLoaded } = useCitySearch();
const { settings } = useSettings();
const currentCity = ref<CityData | null>(null);

onMounted(() => {
    loadCities();
});

watch(() => props.truckCoords, (coords) => {
    if (!isLoaded.value || !coords) return;
    if (coords[0] === 0 && coords[1] === 0) return;

    const gameCoords = settings.value.selectedGame === "ats"
        ? convertGeoToAts(coords[0], coords[1])
        : convertGeoToEts2(coords[0], coords[1]);

    const city = getClosestCity(gameCoords[0], gameCoords[1]);
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
