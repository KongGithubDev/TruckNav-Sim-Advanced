export interface DirectionStep {
    id: number;
    type:
        | "depart"
        | "straight"
        | "left"
        | "right"
        | "slight-left"
        | "slight-right"
        | "sharp-left"
        | "sharp-right"
        | "ferry"
        | "roundabout"
        | "destination"
        | "exit-highway";
    text: string;
    distance: number;
    coords: [number, number];
    exitCoords?: [number, number];
    debugAngle?: number;
    debugPrefabId?: number;
    exitCount?: number;
    cumulativeKm?: number;
    exitCumulativeKm?: number;
}

export interface DirectionTranslations {
    headOnRoute: string;
    turnLeft: string;
    turnRight: string;
    keepLeft: string;
    keepRight: string;
    takeExit: string;
    exitAtRoundabout: string;
    roundaboutExit: (exitCount: number, ordinalSuffix: string) => string;
    arrived: string;
}

/**
 * Build a natural-language voice direction phrase like Google Maps.
 * @param step The upcoming direction step
 * @param distanceKm Distance to the turn in km
 * @param locale 'en', 'de', or 'th'
 */
export function buildVoiceDirection(
    step: DirectionStep,
    distanceKm: number,
    locale: string,
): string {
    const turnPhrase = getTurnPhrase(step, locale);
    const finalPhrase = getFinalPhrase(step, locale);

    if (distanceKm >= 1.5) {
        const distKm = Math.round(distanceKm);
        if (locale === "th") {
            return `อีก ${distKm} กิโลเมตร ${turnPhrase}`;
        }
        if (locale === "de") {
            return `In ${distKm} Kilometern, ${turnPhrase}`;
        }
        return `In ${distKm} kilometers, ${turnPhrase}`;
    }
    if (distanceKm >= 0.7) {
        if (locale === "th") {
            return `อีก 1 กิโลเมตร ${turnPhrase}`;
        }
        if (locale === "de") {
            return `In 1 Kilometer, ${turnPhrase}`;
        }
        return `In 1 kilometer, ${turnPhrase}`;
    }
    if (distanceKm >= 0.3) {
        if (locale === "th") {
            return `อีก 500 เมตร ${turnPhrase}`;
        }
        if (locale === "de") {
            return `In 500 Metern, ${turnPhrase}`;
        }
        return `In 500 meters, ${turnPhrase}`;
    }
    if (distanceKm >= 0.08) {
        return turnPhrase;
    }
    return finalPhrase;
}

function getTurnPhrase(step: DirectionStep, locale: string): string {
    const type = step.type;
    const exitCount = step.exitCount || 0;

    // Special handling for roundabout with exit count
    if (type === "roundabout" && exitCount > 0) {
        if (locale === "th") {
            return `วงเวียน ทางออกที่ ${exitCount}`;
        }
        if (locale === "de") {
            return `Am Kreisverkehr nehmen Sie die ${exitCount}. Ausfahrt`;
        }
        const suffix =
            exitCount === 1
                ? "st"
                : exitCount === 2
                  ? "nd"
                  : exitCount === 3
                    ? "rd"
                    : "th";
        return `At the roundabout, take the ${exitCount}${suffix} exit`;
    }

    // Highway exit with number (e.g. "Take exit 23")
    if (type === "exit-highway" && exitCount > 0) {
        if (locale === "th") {
            return `ออกทางออกที่ ${exitCount}`;
        }
        if (locale === "de") {
            return `Nehmen Sie Ausfahrt ${exitCount}`;
        }
        return `Take exit ${exitCount}`;
    }

    const phrases: Record<string, { en: string; th: string; de: string }> = {
        left: { en: "Turn left", th: "เลี้ยวซ้าย", de: "Links abbiegen" },
        right: { en: "Turn right", th: "เลี้ยวขวา", de: "Rechts abbiegen" },
        "slight-left": { en: "Keep left", th: "ชิดซ้าย", de: "Links halten" },
        "slight-right": { en: "Keep right", th: "ชิดขวา", de: "Rechts halten" },
        "sharp-left": { en: "Turn sharp left", th: "เลี้ยวซ้ายหักศอก", de: "Scharf links abbiegen" },
        "sharp-right": { en: "Turn sharp right", th: "เลี้ยวขวาหักศอก", de: "Scharf rechts abbiegen" },
        "exit-highway": { en: "Take the exit", th: "ออกทางออก", de: "Ausfahrt nehmen" },
        roundabout: { en: "Exit at the roundabout", th: "ออกที่วงเวียน", de: "Am Kreisverkehr ausfahren" },
        ferry: { en: "Take the ferry", th: "ขึ้นเรือเฟอร์รี่", de: "Fähre nehmen" },
        depart: { en: "Head on route", th: "เริ่มเส้นทาง", de: "Route beginnen" },
        straight: { en: "Continue straight", th: "ตรงไป", de: "Geradeaus" },
    };

    const phrase = phrases[type];
    if (phrase) {
        return phrase[locale as "en" | "th" | "de"];
    }
    if (locale === "th") return "เลี้ยวซ้าย";
    if (locale === "de") return "Links abbiegen";
    return "Turn left";
}

function getFinalPhrase(step: DirectionStep, locale: string): string {
    const type = step.type;

    // Special for roundabout
    if (type === "roundabout" && step.exitCount && step.exitCount > 0) {
        if (locale === "th") {
            return `ออกทางที่ ${step.exitCount} เดี๋ยวนี้`;
        }
        if (locale === "de") {
            return `Nehmen Sie die ${step.exitCount}. Ausfahrt jetzt`;
        }
        return `Take the ${step.exitCount} exit now`;
    }

    // Highway exit with number (e.g. "Take exit 23 now")
    if (type === "exit-highway" && step.exitCount && step.exitCount > 0) {
        if (locale === "th") {
            return `ออกทางออกที่ ${step.exitCount} เดี๋ยวนี้`;
        }
        if (locale === "de") {
            return `Nehmen Sie Ausfahrt ${step.exitCount} jetzt`;
        }
        return `Take exit ${step.exitCount} now`;
    }

    const phrases: Record<string, { en: string; th: string; de: string }> = {
        left: { en: "Turn left now", th: "เลี้ยวซ้ายเดี๋ยวนี้", de: "Jetzt links abbiegen" },
        right: { en: "Turn right now", th: "เลี้ยวขวาเดี๋ยวนี้", de: "Jetzt rechts abbiegen" },
        "slight-left": { en: "Keep left now", th: "ชิดซ้ายเดี๋ยวนี้", de: "Jetzt links halten" },
        "slight-right": { en: "Keep right now", th: "ชิดขวาเดี๋ยวนี้", de: "Jetzt rechts halten" },
        "sharp-left": { en: "Turn sharp left now", th: "เลี้ยวซ้ายหักศอกเดี๋ยวนี้", de: "Jetzt scharf links abbiegen" },
        "sharp-right": { en: "Turn sharp right now", th: "เลี้ยวขวาหักศอกเดี๋ยวนี้", de: "Jetzt scharf rechts abbiegen" },
        "exit-highway": { en: "Take the exit now", th: "ออกทางออกเดี๋ยวนี้", de: "Jetzt Ausfahrt nehmen" },
        ferry: { en: "Take the ferry now", th: "ขึ้นเรือเฟอร์รี่เดี๋ยวนี้", de: "Jetzt Fähre nehmen" },
    };

    const phrase = phrases[type];
    if (phrase) {
        return phrase[locale as "en" | "th" | "de"];
    }
    if (locale === "th") return "เลี้ยวซ้ายเดี๋ยวนี้";
    if (locale === "de") return "Jetzt links abbiegen";
    return "Turn left now";
}

/**
 * Build a combined voice direction for two nearby turns (Google Maps style).
 * e.g. "In 1 kilometer, turn left, then turn right"
 *      "In 1 Kilometer, links abbiegen, dann rechts abbiegen"
 *      "อีก 1 กิโลเมตร เลี้ยวซ้าย แล้วเลี้ยวขวา"
 */
export function buildCombinedVoiceDirection(
    currentStep: DirectionStep,
    nextStep: DirectionStep,
    distanceKm: number,
    locale: string,
): string {
    const currentPhrase = buildVoiceDirection(currentStep, distanceKm, locale);
    const nextPhrase = getTurnPhrase(nextStep, locale);

    if (locale === "th") {
        return `${currentPhrase} แล้ว${nextPhrase}`;
    }
    if (locale === "de") {
        return `${currentPhrase}, dann ${nextPhrase.toLowerCase()}`;
    }
    return `${currentPhrase}, then ${nextPhrase.toLowerCase()}`;
}

export function generateDirectionsList(
    nodeSequence: number[],
    nodeKms: Float32Array,
    sequenceManeuvers: Int8Array,
    sequenceExits: Int8Array,
    nodeCoords: Map<number, [number, number]>,
    tr?: DirectionTranslations,
): DirectionStep[] {
    const steps: DirectionStep[] = [];
    if (nodeSequence.length < 2) return steps;

    steps.push({
        id: 0,
        type: "depart",
        text: tr?.headOnRoute ?? "Head on Route",
        distance: 0,
        coords: nodeCoords.get(nodeSequence[0]!) || [0, 0],
    });

    let lastStepKm = 0;
    let inRoundabout = false;

    for (let i = 0; i < nodeSequence.length - 1; i++) {
        const curr = nodeSequence[i];
        const next = nodeSequence[i + 1];
        const maneuver = sequenceManeuvers[i]!;

        if (maneuver === 3) {
            if (inRoundabout) continue;
            inRoundabout = true;
        } else {
            inRoundabout = false;
        }

        if (maneuver > 0 && maneuver !== 4) {
            let turnType: DirectionStep["type"] = "straight";
            let turnText = "";
            let exitCount = sequenceExits[i]!;

            switch (maneuver) {
                case 1:
                    turnType = "left";
                    turnText = tr?.turnLeft ?? "Turn left";
                    break;
                case 2:
                    turnType = "right";
                    turnText = tr?.turnRight ?? "Turn right";
                    break;
                case 3: {
                    turnType = "roundabout";
                    if (exitCount && exitCount > 0) {
                        const suffix =
                            exitCount === 1
                                ? "st"
                                : exitCount === 2
                                  ? "nd"
                                  : exitCount === 3
                                    ? "rd"
                                    : "th";
                        turnText = tr
                            ? tr.roundaboutExit(exitCount, suffix)
                            : `${exitCount}${suffix} exit`;
                    } else {
                        turnText = tr?.exitAtRoundabout ?? "exit at the roundabout";
                    }
                    break;
                }
                case 5:
                    turnType = "exit-highway";
                    turnText = tr?.takeExit ?? "Take the exit";
                    break;
                case 6:
                    turnType = "slight-left";
                    turnText = tr?.keepLeft ?? "Keep left";
                    break;
                case 7:
                    turnType = "slight-right";
                    turnText = tr?.keepRight ?? "Keep right";
                    break;
            }

            if (turnText !== "") {
                steps[steps.length - 1]!.distance = nodeKms[i]! - lastStepKm;
                steps.push({
                    id: curr!,
                    type: turnType,
                    text: turnText,
                    distance: 0,
                    cumulativeKm: nodeKms[i],
                    exitCumulativeKm: nodeKms[i + 1],
                    coords: nodeCoords.get(curr!) || [0, 0],
                    exitCoords: nodeCoords.get(next!) || [0, 0],
                    exitCount: exitCount,
                });
                lastStepKm = nodeKms[i]!;
            }
        }
    }

    // Add Destination
    const totalKm = nodeKms[nodeSequence.length - 1];
    steps[steps.length - 1]!.distance = Math.max(0, totalKm! - lastStepKm);
    steps.push({
        id: nodeSequence[nodeSequence.length - 1]!,
        type: "destination",
        text: tr?.arrived ?? "Arrived",
        distance: 0,
        coords: nodeCoords.get(nodeSequence[nodeSequence.length - 1]!) || [
            0, 0,
        ],
    });

    return steps;
}
