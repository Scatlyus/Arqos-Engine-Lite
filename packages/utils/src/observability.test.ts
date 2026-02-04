
import { FileMetricsSink, MetricEvent } from './observability';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileMetricsSink', () => {
    let tmpDir: string;
    let sink: FileMetricsSink;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
        sink = new FileMetricsSink(tmpDir, 'test.jsonl');
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should write metrics to file', async () => {
        const event: MetricEvent = {
            tool_id: 'test-tool',
            metricData: { duration: 100, success: true },
            timestamp: new Date('2023-01-01T00:00:00Z')
        };

        await sink.record(event);

        const filePath = path.join(tmpDir, 'test.jsonl');
        expect(fs.existsSync(filePath)).toBe(true);

        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('"tool_id":"test-tool"');
        expect(content).toContain('"duration":100');
    });

    it('should append metrics to file', async () => {
        await sink.record({
            tool_id: 'tool-1',
            metricData: { idx: 1 },
            timestamp: new Date()
        });
        await sink.record({
            tool_id: 'tool-2',
            metricData: { idx: 2 },
            timestamp: new Date()
        });

        const filePath = path.join(tmpDir, 'test.jsonl');
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        expect(lines.length).toBe(2);
    });
});
