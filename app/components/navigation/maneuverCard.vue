<script lang="ts" setup>
import type { DirectionStep } from "~/assets/utils/routing/directions";

const { activeSettings, settings } = useSettings();

const props = defineProps<{
    upcomingTurns: DirectionStep[];
    distanceToNextTurn: number;
    nextInstruction: string;
    destinationName?: string;
}>();

const displayTurns = computed(() => {
    return props.upcomingTurns.slice(1, 3);
});

const primaryTurn = computed(() => displayTurns.value[0] || null);

const exitLabel = computed(() => {
    const turn = primaryTurn.value;
    if (!turn || !turn.exitCount) return null;
    const locale = settings.value.locale || "en";
    if (turn.type === "exit-highway") {
        if (locale === "de") return `Ausfahrt ${turn.exitCount}`;
        return `Exit ${turn.exitCount}`;
    }
    if (turn.type === "roundabout") {
        if (locale === "de") return `Ausfahrt ${turn.exitCount}`;
        return `Exit ${turn.exitCount}`;
    }
    return null;
});

/** True when the next turn is far away — show "Continue straight" instead of turn instruction */
const isLongStraight = computed(() => props.distanceToNextTurn > 10);

/** Build exit prefix: "Take exit 23, then " / "ออกทางออกที่ ๒๓ แล้ว " / "Ausfahrt 23 nehmen, dann " — empty string when no exit */
const exitPrefix = computed(() => {
    const turn = primaryTurn.value;
    if (!turn || turn.type !== "exit-highway" || !turn.exitCount) return "";
    const locale = settings.value.locale || "en";
    if (locale === "th") {
        return `ออกทางออกที่ ${turn.exitCount} แล้ว`;
    }
    if (locale === "de") {
        return `Ausfahrt ${turn.exitCount} nehmen, dann `;
    }
    return `Take exit ${turn.exitCount}, then `;
});

/**
 * Build a "towards" direction suffix using the destination city name.
 * Returns empty string when no destination is available.
 */
const towardsSuffix = computed(() => {
    const dest = props.destinationName;
    if (!dest) return "";
    const locale = settings.value.locale || "en";
    if (locale === "th") {
        return ` ไป ${dest}`;   // "ไป แฟรงก์เฟิร์ต"
    }
    if (locale === "de") {
        return ` in Richtung ${dest}`;  // "in Richtung Frankfurt"
    }
    return ` towards ${dest}`;  // "towards Frankfurt"
});

/**
 * Formatted straight instruction (priority order):
 *   1. "Take exit 23, then continue straight for 45 km"
 *   2. "Continue towards Frankfurt for 45 km"
 *   3. "Continue straight for 45 km"
 *
 * German:
 *   1. "Ausfahrt 23 nehmen, dann geradeaus weiter für 45 km"
 *   2. "Weiter in Richtung Frankfurt für 45 km"
 *   3. "Geradeaus weiter für 45 km"
 *
 * Thai:
 *   1. "ออกทางออกที่ 23 แล้วตรงไปอีก 45 กิโลเมตร"
 *   2. "ตรงไปแฟรงก์เฟิร์ตอีก 45 กิโลเมตร"
 *   3. "ตรงไปอีก 45 กิโลเมตร"
 */
const straightInstruction = computed(() => {
    const locale = settings.value.locale || "en";
    const rounded = Math.round(routeDistanceConverted.value);
    const distStr = String(rounded);
    const prefix = exitPrefix.value;
    const towards = towardsSuffix.value;

    // Priority 1: exit prefix
    if (prefix) {
        if (locale === "th") return `${prefix}ตรงไปอีก ${distStr} ${distanceUnit.value}`;
        if (locale === "de") return `${prefix}geradeaus weiter für ${rounded} ${distanceUnit.value}`;
        return `${prefix}continue straight for ${rounded} ${distanceUnit.value}`;
    }

    // Priority 2: destination city name — highway-aware when on highway
    if (towards) {
        const isOnHighway = primaryTurn.value?.type === "exit-highway";
        if (isOnHighway) {
            if (locale === "th") return `อยู่บนทางด่วน${towards} อีก ${distStr} ${distanceUnit.value}`;
            if (locale === "de") return `Bleiben Sie auf der Autobahn${towards} für ${rounded} ${distanceUnit.value}`;
            return `Stay on the highway${towards} for ${rounded} ${distanceUnit.value}`;
        }
        if (locale === "th") return `ตรง${towards} อีก ${distStr} ${distanceUnit.value}`;
        if (locale === "de") return `Weiter${towards} für ${rounded} ${distanceUnit.value}`;
        return `Continue${towards} for ${rounded} ${distanceUnit.value}`;
    }

    // Priority 3: plain fallback — road-aware: detect if on highway
    const isOnHighway = primaryTurn.value?.type === "exit-highway";
    if (isOnHighway) {
        if (locale === "th") return `อยู่บนทางด่วนต่อไปอีก ${distStr} ${distanceUnit.value}`;
        if (locale === "de") return `Bleiben Sie auf der Autobahn für ${rounded} ${distanceUnit.value}`;
        return `Stay on the highway for ${rounded} ${distanceUnit.value}`;
    }
    if (locale === "th") return `ตรงไปอีก ${distStr} ${distanceUnit.value}`;
    if (locale === "de") return `Geradeaus weiter für ${rounded} ${distanceUnit.value}`;
    return `Continue straight for ${rounded} ${distanceUnit.value}`;
});

/** The instruction text — shows straight message when far, otherwise the turn instruction */
const displayInstruction = computed(() =>
    isLongStraight.value ? straightInstruction.value : props.nextInstruction,
);

const { kmToUserUnits, distanceUnit } = useUnitConversion();

const routeDistanceConverted = computed(() =>
    kmToUserUnits(props.distanceToNextTurn),
);
</script>

<template>
    <div class="card">
        <div class="turn-directions">
            <DirectionIcon
                v-for="(turn, index) in displayTurns"
                :key="turn.id"
                :type="turn.type"
                :exit-count="
                    turn.type === 'roundabout' || turn.type === 'exit-highway' ? turn.exitCount : undefined
                "
                :active="index === 0"
                :active-color="activeSettings.routeColor"
            />
        </div>
        <div class="turn-info">
            <p>{{ routeDistanceConverted }} {{ distanceUnit }}</p>
            <div class="instruction-row">
                <p>{{ displayInstruction }}</p>
                <span
                    v-if="exitLabel && !(isLongStraight && exitPrefix)"
                    class="exit-badge"
                    :style="{ '--badge-color': activeSettings.routeColor }"
                >
                    {{ exitLabel }}
                </span>
            </div>
        </div>
    </div>
</template>

<style scoped src="~/assets/scss/scoped/navigation/maneuverCard.scss"></style>
