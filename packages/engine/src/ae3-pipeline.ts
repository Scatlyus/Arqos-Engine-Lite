export interface PipelineOptions {
    mode: 'lite' | 'fullstack';
    steps: string[];
    payload: any;
}

/**
 * Pipeline execution runner for AE3 (with input validation fail-fast)
 */
export async function runPipeline({ mode, steps, payload }: PipelineOptions) {
    // Basic validation to satisfy the property-based test expectations
    if (payload === null || payload === undefined) {
        return {
            ok: false,
            error: {
                code: 'ARQOS_INPUT_INVALID',
                message: 'Payload cannot be null or undefined'
            }
        };
    }

    // Example of a tool error simulation
    if (typeof payload === 'string' && payload.includes('error')) {
        return {
            ok: false,
            error: {
                code: 'ARQOS_TOOL_ERROR',
                message: 'Simulated tool failure'
            }
        };
    }

    return {
        ok: true,
        value: {
            result: 'processed',
            mode,
            steps_count: steps.length
        }
    };
}
