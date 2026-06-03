import { type Ref } from "vue";
import type { Map as MapLibreGl } from "maplibre-gl";

type WeatherState = "clear" | "rain" | "snow" | "fog";

export function useWeatherOverlay(map: Ref<MapLibreGl | null>) {
    const { activeSettings } = useSettings();

    let rainCanvas: HTMLCanvasElement | null = null;
    let rainCtx: CanvasRenderingContext2D | null = null;
    let raindrops: Raindrop[] = [];
    let animFrameId: number | null = null;
    let currentState: WeatherState = "clear";
    let targetOpacity = 0;
    let weatherOpacity = 0;
    let lastWipers = false;
    let fogTimer: ReturnType<typeof setTimeout> | null = null;
    let canvasCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    interface Raindrop {
        x: number;
        y: number;
        len: number;
        speed: number;
        opacity: number;
        wind: number;
    }

    const RAIN_COUNT = 150;
    const SNOW_COUNT = 100;

    function createCanvas() {
        if (!map.value) return null;
        const container = map.value.getContainer();
        if (!container) return null;

        const existing = container.querySelector(".weather-overlay-canvas") as HTMLCanvasElement;
        if (existing) existing.remove();

        const canvas = document.createElement("canvas");
        canvas.className = "weather-overlay-canvas";
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;
        container.appendChild(canvas);
        return canvas;
    }

    function initRaindrops(count: number, type: "rain" | "snow") {
        const drops: Raindrop[] = [];
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let i = 0; i < count; i++) {
            drops.push({
                x: Math.random() * w,
                y: Math.random() * h,
                len: type === "rain" ? 8 + Math.random() * 12 : 3 + Math.random() * 5,
                speed: type === "rain" ? 400 + Math.random() * 300 : 60 + Math.random() * 80,
                opacity: type === "rain" ? 0.15 + Math.random() * 0.25 : 0.3 + Math.random() * 0.4,
                wind: type === "rain" ? 40 + Math.random() * 30 : 10 + Math.random() * 15,
            });
        }
        return drops;
    }

    function drawRain(dt: number) {
        if (!rainCtx || !rainCanvas) return;
        const w = rainCanvas.width;
        const h = rainCanvas.height;

        rainCtx.clearRect(0, 0, w, h);

        if (weatherOpacity > 0.05) {
            rainCtx.fillStyle = `rgba(100, 120, 140, ${weatherOpacity * 0.06})`;
            rainCtx.fillRect(0, 0, w, h);
        }

        for (const drop of raindrops) {
            const alpha = drop.opacity * weatherOpacity;
            rainCtx.beginPath();
            rainCtx.moveTo(drop.x, drop.y);
            rainCtx.lineTo(drop.x + drop.wind * 0.016, drop.y + drop.len);
            rainCtx.strokeStyle = `rgba(180, 200, 230, ${alpha})`;
            rainCtx.stroke();

            drop.y += drop.speed * dt;
            drop.x += drop.wind * dt;

            if (drop.y > h + 20) { drop.y = -20; drop.x = Math.random() * w; }
            if (drop.x > w + 20) drop.x = -20;
            if (drop.x < -20) drop.x = w + 20;
        }
    }

    function drawSnow(dt: number) {
        if (!rainCtx || !rainCanvas) return;
        const w = rainCanvas.width;
        const h = rainCanvas.height;

        rainCtx.clearRect(0, 0, w, h);

        if (weatherOpacity > 0.05) {
            rainCtx.fillStyle = `rgba(160, 180, 200, ${weatherOpacity * 0.08})`;
            rainCtx.fillRect(0, 0, w, h);
        }

        for (const drop of raindrops) {
            const alpha = drop.opacity * weatherOpacity;
            rainCtx.beginPath();
            rainCtx.arc(drop.x, drop.y, drop.len * 0.4, 0, Math.PI * 2);
            rainCtx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
            rainCtx.fill();

            drop.y += drop.speed * dt;
            drop.x += Math.sin(drop.y * 0.005) * 15 * dt;

            if (drop.y > h + 10) { drop.y = -10; drop.x = Math.random() * w; }
        }
    }

    let lastTime = 0;
    function animate(time: number) {
        if (!rainCanvas) {
            animFrameId = null;
            return;
        }

        const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
        lastTime = time;

        // Smooth opacity transition
        const diff = targetOpacity - weatherOpacity;
        if (Math.abs(diff) > 0.005) {
            weatherOpacity += diff * 0.04;
        } else {
            weatherOpacity = targetOpacity;
        }

        if (currentState !== "clear" && weatherOpacity > 0.005) {
            if (currentState === "rain" || currentState === "fog") {
                drawRain(dt);
            } else if (currentState === "snow") {
                drawSnow(dt);
            }
        } else {
            rainCtx?.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
        }

        // Stop animation when fully faded out
        if (currentState === "clear" && weatherOpacity <= 0.005 && animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
            // Clean up canvas
            if (rainCanvas && canvasCleanupTimer) {
                clearTimeout(canvasCleanupTimer);
            }
            canvasCleanupTimer = setTimeout(() => {
                if (rainCanvas && targetOpacity === 0) {
                    rainCanvas.remove();
                    rainCanvas = null;
                    rainCtx = null;
                }
            }, 500);
            return;
        }

        animFrameId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (animFrameId) return;
        lastTime = 0;
        animFrameId = requestAnimationFrame(animate);
    }

    function stopAnimation() {
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        if (rainCtx && rainCanvas) {
            rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
        }
    }

    function setFog(intensity: number) {
        if (!map.value) return;
        try {
            if (intensity > 0.05) {
                (map.value as any).setFog({
                    range: [0.5, 8],
                    color: `rgba(180, 190, 200, ${Math.min(intensity * 0.4, 0.3)})`,
                    "high-color": `rgba(160, 170, 180, ${Math.min(intensity * 0.3, 0.2)})`,
                    "space-color": "rgba(140, 150, 160, 0.1)",
                });
            } else {
                (map.value as any).setFog(null);
            }
        } catch (e) {
            // Fog API may not be available
        }
    }

    function applyWeather(state: WeatherState) {
        currentState = state;

        if (state === "clear") {
            targetOpacity = 0;
            setFog(0);
            return;
        }

        if (!rainCanvas) {
            rainCanvas = createCanvas();
            if (!rainCanvas) return;
            rainCtx = rainCanvas.getContext("2d");
            resizeCanvas();
        }

        if (state === "rain") {
            raindrops = initRaindrops(RAIN_COUNT, "rain");
            targetOpacity = 1;
            setFog(0.6);
        } else if (state === "snow") {
            raindrops = initRaindrops(SNOW_COUNT, "snow");
            targetOpacity = 1;
            setFog(0.8);
        } else if (state === "fog") {
            raindrops = initRaindrops(20, "rain");
            targetOpacity = 0.6;
            setFog(1);
        }

        startAnimation();
    }

    function resizeCanvas() {
        if (!rainCanvas) return;
        rainCanvas.width = window.innerWidth;
        rainCanvas.height = window.innerHeight;
    }

    function onResize() {
        resizeCanvas();
        if (currentState === "rain") {
            raindrops = initRaindrops(RAIN_COUNT, "rain");
        } else if (currentState === "snow") {
            raindrops = initRaindrops(SNOW_COUNT, "snow");
        }
    }

    function detectWeather(wipers: boolean, gameTime: string | undefined): WeatherState {
        if (!wipers) return "clear";
        if (!gameTime) return "rain";

        // Parse hour from game time
        const parts = gameTime.trim().split(" ");
        const timePart = parts[parts.length - 1];
        if (!timePart) return "rain";
        const hourStr = timePart.split(":")[0];
        const hour = hourStr ? parseInt(hourStr, 10) : 12;
        if (isNaN(hour)) return "rain";

        const isFoggyHour = (hour >= 5 && hour < 7) || (hour >= 19 && hour < 21);

        // When wipers are on:
        // - Foggy hours → fog
        // - Night hours (20-5) → snow (looks better with dark background)
        // - Otherwise → rain
        if (isFoggyHour) return "fog";
        if (hour >= 20 || hour < 5) return "snow";
        return "rain";
    }

    function updateWeather(wipers: boolean, gameTime: string | undefined) {
        if (!activeSettings.value.weatherOverlay) {
            if (currentState !== "clear") applyWeather("clear");
            return;
        }

        if (wipers === lastWipers && currentState !== "clear") return;
        lastWipers = wipers;

        if (fogTimer) clearTimeout(fogTimer);
        fogTimer = setTimeout(() => {
            const newState = detectWeather(wipers, gameTime);
            if (newState !== currentState) {
                applyWeather(newState);
            }
        }, 2000);
    }

    function setupWeatherOverlay() {
        window.addEventListener("resize", onResize);
    }

    function teardownWeatherOverlay() {
        window.removeEventListener("resize", onResize);
        stopAnimation();
        if (fogTimer) clearTimeout(fogTimer);
        if (canvasCleanupTimer) clearTimeout(canvasCleanupTimer);
        if (rainCanvas) {
            rainCanvas.remove();
            rainCanvas = null;
            rainCtx = null;
        }
        currentState = "clear";
        weatherOpacity = 0;
        targetOpacity = 0;
        try {
            if (map.value) (map.value as any).setFog(null);
        } catch (e) { /* ignore */ }
    }

    return {
        setupWeatherOverlay,
        teardownWeatherOverlay,
        updateWeather,
    };
}
