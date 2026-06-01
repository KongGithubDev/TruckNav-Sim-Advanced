import { ref, computed } from "vue";
import { useSettings } from "./Settings";

export interface CityData {
    token: string;
    name: string;
    countryToken: string;
    population: number;
    x: number;
    y: number;
    areas: any[];
}

const citiesData = ref<CityData[]>([]);
const isLoaded = ref(false);

export function useCitySearch() {
    const { settings } = useSettings();

    const loadCities = async () => {
        if (isLoaded.value) return;
        try {
            const game = settings.value.selectedGame || "ets2";
            // We use the fetch API to load the JSON file from the public directory
            const res = await fetch(`/data/${game}/map-data/cities.json`);
            if (!res.ok) throw new Error("Failed to load cities.json");
            
            const data = await res.json();
            // Convert the object into an array
            citiesData.value = Object.keys(data).map(key => data[key]);
            isLoaded.value = true;
        } catch (e) {
            console.error("Error loading cities data:", e);
        }
    };

    const searchCities = (query: string, maxResults: number = 5) => {
        if (!query) return [];
        const q = query.toLowerCase();
        return citiesData.value
            .filter(c => c.name.toLowerCase().includes(q))
            .sort((a, b) => {
                // Prioritize exact start match
                if (a.name.toLowerCase().startsWith(q) && !b.name.toLowerCase().startsWith(q)) return -1;
                if (!a.name.toLowerCase().startsWith(q) && b.name.toLowerCase().startsWith(q)) return 1;
                // Then sort by population
                return b.population - a.population;
            })
            .slice(0, maxResults);
    };

    const getClosestCity = (x: number, y: number, maxDistance: number = 20000): CityData | null => {
        if (!citiesData.value.length) return null;

        let closest: CityData | null = null;
        let minDistanceSq = Infinity;

        for (const city of citiesData.value) {
            const distSq = Math.pow(city.x - x, 2) + Math.pow(city.y - y, 2);
            if (distSq < minDistanceSq && distSq < maxDistance * maxDistance) {
                minDistanceSq = distSq;
                closest = city;
            }
        }
        return closest;
    };

    return {
        isLoaded,
        loadCities,
        searchCities,
        getClosestCity
    };
}
