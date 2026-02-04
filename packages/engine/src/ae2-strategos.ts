export interface PlanOptions {
    mode: 'lite' | 'fullstack';
    goal: string;
    tools: string[];
}

/**
 * Deterministic planning function for AE2 Strategos (LITE mode optimized)
 */
export function plan({ mode, goal, tools }: PlanOptions) {
    // Returns a deterministic structure for snapshot testing
    return {
        id: `plan-${goal}-${mode}`,
        strategy: mode === 'lite' ? 'linear' : 'parallel',
        sequence: tools.map((t, i) => ({
            step: i + 1,
            tool_name: t,
            action: 'process'
        })),
        integrity_hash: 'ae2-sha256-placeholder'
    };
}
