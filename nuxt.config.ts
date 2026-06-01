// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: "2025-07-15",
    devtools: { enabled: false },
    ssr: false,
    modules: ["@nuxt/icon", "@nuxt/ui"],

    css: ["~/assets/css/main.css", "~/assets/scss/global/_transitions.scss"],

    icon: {
        mode: "css",

        clientBundle: {
            scan: true,
            sizeLimitKb: 2048,
        },
    },

    vite: {
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: `@use "~/assets/scss/global/variables.scss" as *;
                     @use "~/assets/scss/global/_mixins.scss" as *;
                     @use "~/assets/scss/global/_fonts.scss" as *;`,
                },
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id: string) {
                        if (id.includes("node_modules/maplibre-gl")) return "maplibre";
                        if (id.includes("node_modules/proj4")) return "proj4";
                        if (id.includes("node_modules/@turf")) return "turf";
                        if (id.includes("node_modules/pmtiles")) return "pmtiles";
                        if (id.includes("node_modules/rbush")) return "rbush";
                        if (id.includes("node_modules")) return "vendor";
                    },
                },
            },
        },
    },

    app: {
        head: {
            title: "TruckNavAdvanced",
            meta: [
                {
                    name: "viewport",
                    content:
                        "width=device-width, initial-scale=1, viewport-fit=cover",
                },
            ],
        },
    },

    components: [{ path: "~/components", pathPrefix: false }],
});
