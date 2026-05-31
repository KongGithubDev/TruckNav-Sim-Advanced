import type { GameType } from "~/types";

export type UnitSystem = "metric" | "imperial";
export type TextTheme = "light" | "dark";
export type UiComponent =
    | "speed"
    | "fuel"
    | "sleep"
    | "time"
    | "speedLimit"
    | "topBar";
export type ActiveComponents = UiComponent[];
export type LocaleCode = "en" | "de" | "th";

export interface GameProfile {
    themeColor: string;
    textColor: TextTheme;
    routeColor: string;
    units: UnitSystem;
    ownedDlcs: number[];
    lastDestination: [number, number] | null;
    hasTurnNavigation: boolean;
    fontFamily: string;
    showTraffic: boolean;
    trafficServerId: number;
    autoDayNightTheme: boolean;
    voiceWarnings: boolean;
    voiceLanguage: string;
}

export interface AppSettingsState {
    selectedGame: GameType;
    savedIP: string | null;
    profiles: {
        ets2: GameProfile;
        ats: GameProfile;
    };
    hudBtnSize: number;
    truckMarkerSize: number;
    compactTripFontSize: number;
    activeUiComponents: ActiveComponents;
    locale: LocaleCode;
}

const DEFAULT_PROFILE: GameProfile = {
    themeColor: "#fbc02d",
    textColor: "light",
    routeColor: "#22d3ee",
    units: "metric",
    ownedDlcs: Array.from({ length: 10 }, (_, i) => i + 1),
    lastDestination: null,
    hasTurnNavigation: true,
    fontFamily: "Commissioner",
    showTraffic: false,
    trafficServerId: 2,
    autoDayNightTheme: true,
    voiceWarnings: true,
    voiceLanguage: "", // Will use system default if empty
};

function createDefaultSettings(): AppSettingsState {
    return {
        selectedGame: null,
        savedIP: null,
        profiles: {
            ets2: {
                ...DEFAULT_PROFILE,
                themeColor: "#fbc02d",
                textColor: "dark",
                units: "metric",
            },
            ats: {
                ...DEFAULT_PROFILE,
                themeColor: "#d32f2f",
                ownedDlcs: Array.from({ length: 16 }, (_, i) => i + 1),
                units: "imperial",
                trafficServerId: 11,
            },
        },
        hudBtnSize: 30,
        truckMarkerSize: 40,
        compactTripFontSize: 1.3,
        activeUiComponents: [
            "speed",
            "speedLimit",
            "fuel",
            "time",
            "sleep",
            "topBar",
        ],
        locale: "en",
    };
}

const STORAGE_KEY = "truck-nav-settings";

const DEFAULT_SETTINGS: AppSettingsState = createDefaultSettings();

export const useSettings = () => {
    const settings = useState<AppSettingsState>("app-settings", () =>
        createDefaultSettings(),
    );

    const activeSettings = computed(() => {
        const game = settings.value.selectedGame || "ets2";
        return settings.value.profiles[game as "ets2" | "ats"];
    });

    const applySideEffects = () => {
        document.documentElement.style.setProperty(
            "--theme-color",
            activeSettings.value.themeColor,
        );

        const isLight = activeSettings.value.textColor === "light";

        document.documentElement.style.setProperty(
            "--main-text-color",
            isLight ? "#f2f2f2" : "#333",
        );

        document.documentElement.style.setProperty(
            "--app-font",
            activeSettings.value.fontFamily,
        );

        document.documentElement.style.setProperty(
            "--hud-btn-size",
            `${settings.value.hudBtnSize}px`,
        );

        document.documentElement.style.setProperty(
            "--compact-trip-size",
            `${settings.value.compactTripFontSize}rem`,
        );

        document.documentElement.style.setProperty(
            "--top-bar-height",
            !settings.value.activeUiComponents.includes("topBar")
                ? "0px"
                : "40px",
        );
    };

    const saveSettings = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
        applySideEffects();
    };

    const updateGlobal = <K extends keyof Omit<AppSettingsState, "profiles">>(
        key: K,
        value: AppSettingsState[K],
    ) => {
        (settings.value as any)[key] = value;
        saveSettings();
    };

    const updateProfile = <K extends keyof GameProfile>(
        key: K,
        value: GameProfile[K],
    ) => {
        const game = settings.value.selectedGame || "ets2";
        (settings.value.profiles[game as "ets2" | "ats"] as any)[key] = value;
        saveSettings();
    };

    const initSettings = () => {
        const savedString = localStorage.getItem(STORAGE_KEY);

        if (savedString) {
            try {
                const parsed = JSON.parse(savedString);
                const defaults = createDefaultSettings();
                settings.value = {
                    ...defaults,
                    ...parsed,
                    profiles: {
                        ets2: {
                            ...defaults.profiles.ets2,
                            ...parsed?.profiles?.ets2,
                        },
                        ats: {
                            ...defaults.profiles.ats,
                            ...parsed?.profiles?.ats,
                        },
                    },
                };
            } catch (e) {
                console.error("Corrupt settings found, resetting to defaults.");
                settings.value = createDefaultSettings();
            }
        } else {
            settings.value = createDefaultSettings();
        }

        applySideEffects();
    };

    const resetSettings = () => {
        const game = settings.value.selectedGame || "ets2";

        const currentDest = settings.value.profiles[game].lastDestination;

        const defaults = createDefaultSettings();
        const freshProfile = defaults.profiles[game];
        freshProfile.lastDestination = currentDest;

        settings.value.hudBtnSize = defaults.hudBtnSize;
        settings.value.truckMarkerSize = defaults.truckMarkerSize;
        settings.value.compactTripFontSize = defaults.compactTripFontSize;
        settings.value.activeUiComponents = [...defaults.activeUiComponents];
        settings.value.profiles[game] = freshProfile;

        saveSettings();
    };

    return {
        settings,
        activeSettings,
        DEFAULT_SETTINGS,
        updateGlobal,
        updateProfile,
        initSettings,
        resetSettings,
    };
};
