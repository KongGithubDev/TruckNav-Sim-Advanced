import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.trucknavadvanced.app",
    appName: "TruckNavAdvanced",
    webDir: ".output/public",
    server: { androidScheme: "http" },
    plugins: {
        CapacitorHttp: {
            enabled: true,
        },
        Keyboard: {
            resizeOnFullScreen: false,
        },
    },
};

export default config;
