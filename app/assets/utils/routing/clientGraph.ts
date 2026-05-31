export async function loadGraph(game?: string) {
    if (!game) return { graphBuffer: new ArrayBuffer(0), geometryBuffer: new ArrayBuffer(0) };

    const [graphRes, geometryRes] = await Promise.all([
        fetch(`/data/${game}/roadnetwork/graph.bin`),
        fetch(`/data/${game}/roadnetwork/geometry.bin`),
    ]);

    if (!graphRes.ok || !geometryRes.ok) {
        throw new Error(`Failed to load graph data for ${game}`);
    }

    return {
        graphBuffer: await graphRes.arrayBuffer(),
        geometryBuffer: await geometryRes.arrayBuffer(),
    };
}
