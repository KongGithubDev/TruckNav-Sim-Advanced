<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useCitySearch } from '~/composables/useCitySearch';
import type { CityData } from '~/composables/useCitySearch';

const { t } = useTranslations();

const emit = defineEmits<{
    (e: 'select', city: CityData): void
}>();

const { loadCities, searchCities, isLoaded } = useCitySearch();
const searchQuery = ref("");
const results = ref<CityData[]>([]);
const recentDestinations = ref<CityData[]>([]);
const isFocused = ref(false);

watch(() => isLoaded.value, () => {
    // Loaded
}, { immediate: true });

onMounted(() => {
    loadCities();
    const stored = localStorage.getItem('recent-destinations');
    if (stored) {
        try {
            recentDestinations.value = JSON.parse(stored);
        } catch(e){}
    }
});

watch(searchQuery, (newVal) => {
    if (newVal.length > 1) {
        results.value = searchCities(newVal);
    } else {
        results.value = [];
    }
});

const onSelect = (city: CityData) => {
    searchQuery.value = "";
    results.value = [];
    isFocused.value = false;
    
    const existingIdx = recentDestinations.value.findIndex(c => c.token === city.token);
    if (existingIdx !== -1) {
        recentDestinations.value.splice(existingIdx, 1);
    }
    recentDestinations.value.unshift(city);
    if (recentDestinations.value.length > 5) {
        recentDestinations.value.pop();
    }
    localStorage.setItem('recent-destinations', JSON.stringify(recentDestinations.value));

    emit('select', city);
};

const handleBlur = () => {
    setTimeout(() => {
        isFocused.value = false;
    }, 200);
};

const displayItems = computed(() => {
    if (searchQuery.value.length > 1) return results.value;
    return recentDestinations.value;
});
</script>

<template>
    <div class="search-bar-container" :class="{ 'has-results': displayItems.length > 0 && isFocused }">
        <div class="search-input-wrapper glass-panel">
            <Icon name="lucide:search" class="search-icon" />
            <input 
                v-model="searchQuery" 
                type="text" 
                :placeholder="t('common.searchDestination')" 
                @focus="isFocused = true"
                @blur="handleBlur"
            />
        </div>
        
        <div v-if="displayItems.length > 0 && isFocused" class="search-results glass-panel">
            <div v-if="searchQuery.length <= 1" class="recent-header">
                {{ t('common.recentDestinations') }}
            </div>
            <div 
                v-for="city in displayItems" 
                :key="city.token" 
                class="search-result-item"
                @click="onSelect(city)"
            >
                <div class="city-info">
                    <Icon :name="searchQuery.length > 1 ? 'lucide:map-pin' : 'lucide:history'" class="pin-icon" />
                    <div class="city-text">
                        <span class="city-name">{{ city.name }}</span>
                        <span class="city-country">{{ city.countryToken.toUpperCase() }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.search-bar-container {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 320px;
    z-index: 1000;
    transition: all 0.3s ease;

    .glass-panel {
        background: rgba(34, 46, 60, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .search-input-wrapper {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-radius: 24px;
        transition: border-radius 0.3s;

        .search-icon {
            color: #a1a1aa;
            font-size: 20px;
            margin-right: 12px;
        }

        input {
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-size: 1.6rem;
            width: 100%;
            font-family: inherit;

            &::placeholder {
                color: #a1a1aa;
            }
        }
    }

    &.has-results .search-input-wrapper {
        border-radius: 24px 24px 0 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        border-radius: 0 0 24px 24px;
        border-top: none;
        overflow: hidden;

        .recent-header {
            padding: 12px 16px 4px 16px;
            font-size: 1.2rem;
            color: #a1a1aa;
            text-transform: uppercase;
            font-weight: 600;
        }

        .search-result-item {
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.2s;

            &:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .city-info {
                display: flex;
                align-items: center;

                .pin-icon {
                    color: #22d3ee;
                    margin-right: 12px;
                    font-size: 18px;
                }

                .city-text {
                    display: flex;
                    flex-direction: column;

                    .city-name {
                        color: #fff;
                        font-size: 1.5rem;
                        font-weight: 500;
                    }

                    .city-country {
                        color: #a1a1aa;
                        font-size: 1.2rem;
                        margin-top: 2px;
                    }
                }
            }
        }
    }
}
</style>
