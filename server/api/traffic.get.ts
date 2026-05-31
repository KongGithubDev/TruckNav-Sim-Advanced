import { defineEventHandler, getQuery } from "h3";

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const { x1, y1, x2, y2, server } = query;

    if (!x1 || !y1 || !x2 || !y2 || !server) {
        return {
            error: "Missing parameters: x1, y1, x2, y2, server are required",
        };
    }

    const url = `https://tracker.ets2map.com/v3/area?x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&server=${server}`;

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });

        if (!response.ok) {
            return {
                error: `Tracker API returned ${response.status}`,
            };
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        return {
            error: "Failed to fetch traffic data",
            message: error.message,
        };
    }
});
