/**
 * Standardized error class for the Arqos Engine.
 * Enforces Axioma_019 (Error Normalization).
 */
export class ArqosError extends Error {
    public readonly timestamp: Date;

    constructor(
        message: string,
        public readonly code?: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'ArqosError';
        this.timestamp = new Date();

        // Ensure accurate stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ArqosError);
        }
    }

    /**
     * Helper to identify timeout/abort errors (Axioma_019)
     */
    public isTimeout(): boolean {
        return this.code === 'ETIMEDOUT' || this.message.toLowerCase().includes('timeout');
    }

    /**
     * Helper to identify fail-fast critical errors
     */
    public isFailFast(): boolean {
        return this.code === 'ARQOS_FAIL_FAST';
    }
}
