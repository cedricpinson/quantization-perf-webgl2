import Stats from 'stats.js';
import { QuantizationFormat } from './quantize';

interface QueryInfo {
    query: WebGLQuery;
    active: boolean;
    name: string;
    frameId: number;
}

interface NamedMeasurements {
    [key: string]: number[]; // Just store the array of measurements
}

export class PerformanceMonitor {
    stats: Stats;
    performanceDiv: HTMLDivElement;
    measurementTimes: NamedMeasurements = {};
    averageTimeResults: { [key: string]: number } = {};
    readonly MEASUREMENT_BUFFER_SIZE = 100;
    lastDisplayUpdate = 0;
    readonly displayUpdateInterval = 1000; // 1 second

    // Query-related properties
    private timerQueryExt: any;
    private queryPool: QueryInfo[] = [];
    private frameCount: number = 0;
    private readonly POOL_SIZE = 16;

    activeQuery: QueryInfo | null = null;
    gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.stats = new Stats();

        const statsContainer = document.getElementById('stats');
        if (!statsContainer) {
            throw new Error('Stats container not found');
        }

        statsContainer.appendChild(this.stats.dom);
        this.stats.showPanel(0);

        this.performanceDiv = document.getElementById('log') as HTMLDivElement;
        if (!this.performanceDiv) {
            throw new Error('Element with id "log" not found');
        }

        this.timerQueryExt = this.gl.getExtension('EXT_disjoint_timer_query_webgl2')!;
        if (!this.timerQueryExt) {
            console.warn('EXT_disjoint_timer_query_webgl2 extension not available');
            return;
        }

        for (let i = 0; i < this.POOL_SIZE; i++) {
            const query = this.gl.createQuery()!;
            this.queryPool.push({
                query,
                active: false,
                name: '',
                frameId: -1
            });
        }
    }

    getQueryFromPool(): QueryInfo | null {
        const query = this.queryPool.find(q => !q.active);
        if (query) {
            query.active = true;
            query.frameId = this.frameCount;
        }
        return query || null;
    }

    beginFrame(): void {
        this.stats.begin();

        // Start first query without a name
        const newQuery = this.getQueryFromPool();
        if (newQuery) {
            this.gl.beginQuery(this.timerQueryExt.TIME_ELAPSED_EXT, newQuery.query);
            this.activeQuery = newQuery;
        }
    }

    saveMeasure(name: string): void {
        if (!this.timerQueryExt) return;

        // Name the previous query if it exists
        if (this.activeQuery) {
            this.activeQuery.name = name;
            this.gl.endQuery(this.timerQueryExt.TIME_ELAPSED_EXT);
        }

        // Start new query (without name yet)
        const newQuery = this.getQueryFromPool();
        if (!newQuery) {
            console.warn('No available queries in pool');
            return;
        }

        this.gl.beginQuery(this.timerQueryExt.TIME_ELAPSED_EXT, newQuery.query);
        this.activeQuery = newQuery;
    }

    endFrame(): void {
        // End and name the last measurement as 'frameEnd'
        if (this.activeQuery) {
            this.activeQuery.name = 'frameEnd';
            this.gl.endQuery(this.timerQueryExt.TIME_ELAPSED_EXT);
            this.activeQuery = null;
        }

        this.frameCount++;
        this.stats.end();
    }

    checkQueryResults(): void {
        if (!this.timerQueryExt) return;
        //this.gl.flush();

        // Check all active queries
        for (const queryInfo of this.queryPool) {
            if (!queryInfo.active) continue;

            const available = this.gl.getQueryParameter(
                queryInfo.query,
                this.gl.QUERY_RESULT_AVAILABLE
            );
            const disjoint = this.gl.getParameter(this.timerQueryExt.GPU_DISJOINT_EXT);

            if (available && !disjoint) {
                const timeElapsed = this.gl.getQueryParameter(
                    queryInfo.query,
                    this.gl.QUERY_RESULT
                );
                const milliseconds = timeElapsed / 1000000;
                this.addMeasurement(queryInfo.name, milliseconds);

                // Mark query as available for reuse
                queryInfo.active = false;
            }
        }
    }

    private addMeasurement(name: string, timeMs: number) {
        // Initialize array for this name if it doesn't exist
        if (!this.measurementTimes[name]) {
            this.measurementTimes[name] = new Array(this.MEASUREMENT_BUFFER_SIZE).fill(0);
            this.averageTimeResults[name] = 0;
        }

        const index = this.frameCount % this.MEASUREMENT_BUFFER_SIZE;
        this.measurementTimes[name][index] = timeMs;
    }

    shouldUpdateDisplay(): boolean {
        return performance.now() - this.lastDisplayUpdate >= this.displayUpdateInterval;
    }

    updateDisplay(numVertices: number, numTriangles: number, vertexBytes: number, quantized: QuantizationFormat, version: string) {
        // Calculate averages for each named measurement
        for (const name in this.measurementTimes) {
            const times = this.measurementTimes[name];
            let sum = 0;
            for (let i = 0; i < this.MEASUREMENT_BUFFER_SIZE; i++) {
                sum += times[i];
            }
            const avg = sum / this.MEASUREMENT_BUFFER_SIZE;
            this.averageTimeResults[name] = avg;
        }

        let format = '';
        switch (quantized) {
            case QuantizationFormat.Uncompressed:
                format = 'pos(3x32) norm(3x32) tang(4x32) uv(2x32)';
                break;
            case QuantizationFormat.Angle16Bits:
                format = 'pos(3x16) norm(2x16) tang(1x16) uv(2x16)';
                break;
            case QuantizationFormat.Quaternion12Bits:
                format = 'pos(3x16) quat(4x12) uv(2x16)';
                break;
        }

        const memoryUsage = (numVertices * vertexBytes) / 1024 / 1024;
        const memoryUsageIndices = (numTriangles * 3 * 4) / 1024 / 1024;

        const formattedVertices = numVertices.toLocaleString();
        const formattedTriangles = numTriangles.toLocaleString();


        this.performanceDiv.style.textAlign = 'left';
        this.performanceDiv.innerHTML = [
            `Version: ${version}`,
            `Format: ${format}`,
            `Mesh Vertex size: ${vertexBytes} bytes`,
            `Num Vertices: ${formattedVertices}`,
            `Num Triangles: ${formattedTriangles}`,
            `Mesh Vertex memory usage: ${memoryUsage.toFixed(2)} MB`,
            `Mesh Indices memory usage: ${memoryUsageIndices.toFixed(2)} MB`,
            ...Object.entries(this.averageTimeResults).map(([name, avg]) => `${name}: ${avg.toFixed(2)}ms`),
        ].join('<br>');

        this.lastDisplayUpdate = performance.now();
    }

    cleanup(): void {
        if (!this.timerQueryExt) return;
        this.queryPool.forEach(queryInfo => this.gl.deleteQuery(queryInfo.query));
        this.queryPool = [];
    }
}