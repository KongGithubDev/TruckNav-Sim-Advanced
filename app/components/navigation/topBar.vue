<script lang="ts" setup>
const props = defineProps<{
    truckSpeed: number;
    gameConnected: boolean;
    fuel: number;
    restStopMinutes: number;
    restStopTime: string;
    gameTime: string;
    isWeb: boolean;
    airPressure?: number;
    wipers?: boolean;
}>();

const { settings } = useSettings();
const { t } = useTranslations();

const { kmToUserUnits, literToUserUnits, speedUnit, fuelUnit } =
    useUnitConversion();

const truckSpeedConverted = computed(() => kmToUserUnits(props.truckSpeed));
const fuelConverted = computed(() => literToUserUnits(props.fuel));
</script>

<template>
    <div class="game-information" :class="{ 'is-native': !isWeb }">
        <div class="truck-info">
        </div>

        <div v-if="gameConnected" class="gas-sleep-time">
            <div class="gas-sleep">
                <div
                    v-show="settings.activeUiComponents.includes('fuel')"
                    class="fuel-amount"
                >
                    <Icon
                        name="lucide:fuel"
                        :class="{ 'pulse-red': fuel < 100 }"
                        size="22"
                    />
                    <p>
                        {{ fuelConverted
                        }}<span class="liters">{{ fuelUnit }}</span>
                    </p>
                </div>

                <div
                    v-show="airPressure !== undefined && airPressure > 0"
                    class="air-pressure"
                    title="Air pressure"
                >
                    <Icon name="lucide:gauge" size="20" />
                    <p>{{ Math.round(airPressure ?? 0) }}<span class="unit">psi</span></p>
                </div>

                <div
                    v-if="wipers"
                    class="wipers-indicator"
                    title="Wipers on"
                >
                    <Icon
                        name="lucide:droplets"
                        size="20"
                        class="wipers-icon"
                    />
                </div>

                <div
                    v-show="settings.activeUiComponents.includes('sleep')"
                    class="sleep-div"
                >
                    <Icon
                        name="lucide:bed-double"
                        class="sleep-icon"
                        size="22"
                        :class="{ 'pulse-blue': restStopMinutes < 90 }"
                    />
                    <p>{{ restStopTime }}</p>
                </div>
            </div>

            <p
                v-show="settings.activeUiComponents.includes('time')"
                class="game-time"
            >
                {{ gameTime }}
            </p>
        </div>

        <div v-else class="disconnected-div">
            <p class="disconnected-message">{{ t("common.gameOffline") }}</p>
            <Icon name="lucide:wifi-off" class="disconnected-icon" />
        </div>
    </div>
</template>

<style
    lang="scss"
    scoped
    src="~/assets/scss/scoped/navigation/topBar.scss"
></style>
