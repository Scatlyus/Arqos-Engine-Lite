/**
 * Arqos Performance Profiler
 * High-resolution timing and metrics collection for AE components.
 */

export interface ProfileMetric {
    name: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    metadata?: Record<string, any>;
}

export class Profiler {
    private static instance: Profiler;
    private metrics: Map<string, ProfileMetric[]> = new Map();
    private activeSpans: Map<string, ProfileMetric> = new Map();

    private constructor() { }

    public static getInstance(): Profiler {
        if (!Profiler.instance) {
            Profiler.instance = new Profiler();
        }
        return Profiler.instance;
    }

    /**
     * Inicia uma medição de tempo
     */
    public start(name: string, metadata?: Record<string, any>): string {
        const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const metric: ProfileMetric = {
            name,
            startTime: performance.now(),
            metadata
        };
        this.activeSpans.set(id, metric);
        return id;
    }

    /**
     * Finaliza uma medição de tempo
     */
    public end(id: string, additionalMetadata?: Record<string, any>): number {
        const span = this.activeSpans.get(id);
        if (!span) return 0;

        span.endTime = performance.now();
        span.durationMs = span.endTime - span.startTime;
        span.metadata = { ...span.metadata, ...additionalMetadata };

        const history = this.metrics.get(span.name) || [];
        history.push(span);
        this.metrics.set(span.name, history);

        this.activeSpans.delete(id);
        return span.durationMs;
    }

    /**
     * Captura o resultado de uma função assíncrona
     */
    public async profile<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
        const id = this.start(name, metadata);
        try {
            const result = await fn();
            this.end(id);
            return result;
        } catch (error) {
            this.end(id, { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Obtém estatísticas por componente
     */
    public getStats(name: string) {
        const history = this.metrics.get(name) || [];
        if (history.length === 0) return null;

        const durations = history.map(h => h.durationMs!).sort((a, b) => a - b);
        const count = durations.length;

        return {
            name,
            count,
            min: durations[0],
            max: durations[count - 1],
            avg: durations.reduce((a, b) => a + b, 0) / count,
            p50: durations[Math.floor(count * 0.5)],
            p95: durations[Math.floor(count * 0.95)],
            p99: durations[Math.floor(count * 0.99)],
        };
    }

    /**
     * Exporta todos os dados
     */
    public export(): Record<string, any> {
        const report: Record<string, any> = {};
        for (const name of this.metrics.keys()) {
            report[name] = this.getStats(name);
        }
        return report;
    }

    public clear(): void {
        this.metrics.clear();
        this.activeSpans.clear();
    }
}

export const profiler = Profiler.getInstance();
