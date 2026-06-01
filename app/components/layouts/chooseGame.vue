<script lang="ts" setup>
const props = defineProps<{
    launchMap: () => void;
    goToDesktopIndex: () => void;
}>();
const { selectedGame, commitSelection } = useGameSelection();
const { isWeb, isElectron } = usePlatform();
const { t } = useTranslations();

const isEntering = ref(false);

const handleStart = () => {
    if (!selectedGame.value) return;
    isEntering.value = true;
    commitSelection();
    setTimeout(() => {
        props.launchMap();
    }, 400);
};

const gameMeta = computed(() => ({
    ats: {
        name: "American Truck Simulator",
        short: "ATS",
        color: "#d32f2f",
        tagline: "Explore the American highways",
        gradient: "linear-gradient(135deg, #1a0a0a, #2d1515)",
        accent: "rgba(211, 47, 47, 0.6)",
    },
    ets2: {
        name: "Euro Truck Simulator 2",
        short: "ETS2",
        color: "#fbc02d",
        tagline: "Conquer the European roads",
        gradient: "linear-gradient(135deg, #1a1a0a, #2d2d15)",
        accent: "rgba(251, 192, 45, 0.6)",
    },
}));
</script>

<template>
    <div class="choose-game-wrapper" :class="{ 'is-entering': isEntering }">
        <!-- Decorative background elements -->
        <div class="bg-grid"></div>
        <div class="bg-glow glow-1"></div>
        <div class="bg-glow glow-2"></div>

        <!-- Top bar -->
        <div class="game-top-bar">
            <button
                v-show="isElectron"
                @click="goToDesktopIndex"
                class="back-btn"
            >
                <Icon name="lucide:arrow-left" size="20" />
            </button>

            <div class="top-logo">
                <Icon name="lucide:compass" class="logo-icon" size="22" />
                <span class="logo-text">TruckNavAdvanced</span>
                <span class="logo-version">v0.1.1</span>
            </div>
        </div>

        <!-- Main content -->
        <div class="game-content">
            <div class="game-header">
                <h1 class="game-title">{{ t("common.selectGame") }}</h1>
                <p class="game-subtitle">Choose your driving experience</p>
            </div>

            <div class="game-cards">
                <div
                    v-for="(meta, key) in gameMeta"
                    :key="key"
                    class="game-card"
                    :class="{
                        'is-selected': selectedGame === key,
                        'is-ats': key === 'ats',
                        'is-ets2': key === 'ets2',
                    }"
                    :style="{
                        '--game-color': meta.color,
                        '--game-accent': meta.accent,
                        '--game-gradient': meta.gradient,
                    }"
                    @click="selectedGame = key"
                    tabindex="0"
                    role="button"
                    @keydown.enter="selectedGame = key"
                    @keydown.space.prevent="selectedGame = key"
                >
                    <!-- Card background image -->
                    <div class="card-image-layer">
                        <img
                            :src="`/images/game-covers/${key}.webp`"
                            :alt="meta.name"
                            loading="lazy"
                        />
                        <div class="card-image-overlay"></div>
                    </div>

                    <!-- Selected glow ring -->
                    <div class="card-selected-ring"></div>

                    <!-- Card content -->
                    <div class="card-content">
                        <div class="card-badge">{{ meta.short }}</div>
                        <h2 class="card-name">{{ meta.name }}</h2>
                        <p class="card-desc">{{ meta.tagline }}</p>

                        <div class="card-features">
                            <div class="card-feature">
                                <Icon name="lucide:map" size="14" />
                                <span>Full Map Support</span>
                            </div>
                            <div class="card-feature">
                                <Icon name="lucide:traffic-cone" size="14" />
                                <span>Live Traffic</span>
                            </div>
                        </div>
                    </div>

                    <!-- Selected indicator -->
                    <div v-if="selectedGame === key" class="card-check">
                        <Icon name="lucide:check-circle" size="28" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom bar -->
        <div class="game-bottom-bar">
            <button
                :disabled="!selectedGame"
                @click.prevent="handleStart"
                class="start-btn"
                :style="{ '--btn-color': selectedGame ? gameMeta[selectedGame].color : '#555' }"
            >
                <span class="start-btn-text">{{ t("common.startNavigation") }}</span>
                <Icon name="lucide:map-pinned" size="20" />
                <div v-if="isEntering" class="btn-loader"></div>
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped src="~/assets/scss/scoped/layouts/chooseGame.scss"></style>
