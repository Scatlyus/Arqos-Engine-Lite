import * as fs from 'fs/promises';
import * as path from 'path';

export interface MetricEvent {
    tool_id: string;
    metricData: Record<string, number | string | boolean>;
    timestamp: Date;
}

export interface MetricsSink {
    record(event: MetricEvent): Promise<void>;
}

export class FileMetricsSink implements MetricsSink {
    private filePath: string;

    constructor(storageDir: string, filename: string = 'metrics.jsonl') {
        this.filePath = path.join(storageDir, filename);
    }

    async record(event: MetricEvent): Promise<void> {
        const line = JSON.stringify(event) + '\n';
        try {
            await fs.appendFile(this.filePath, line, 'utf8');
        } catch (error) {
            // Fail safely to avoid crashing the engine
            console.warn(`[FileMetricsSink] Failed to write metric: ${error}`);
        }
    }
}

export class NoOpMetricsSink implements MetricsSink {
    async record(event: MetricEvent): Promise<void> {
        // Do nothing
    }
}
