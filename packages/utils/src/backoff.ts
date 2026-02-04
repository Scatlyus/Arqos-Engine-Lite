/**
 * Utilitários de backoff e retry para Arqos Engine
 * Alinhado com Axioma_002 (Waiting State) e DRY
 */

/**
 * Promise-based sleep helper
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Opções para execução com retry
 */
export interface RetryOptions {
    retries: number;
    delay: number;
    onRetry?: (attempt: number, error: any, nextDelay: number) => void;
    shouldRetry?: (error: any) => boolean;
}

/**
 * Executa uma função assíncrona com política de retry e exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
): Promise<T> {
    let lastError: any;
    const { retries, delay, onRetry, shouldRetry } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Verificar se deve continuar tentando
            if (shouldRetry && !shouldRetry(error)) {
                throw error;
            }

            // Se ainda houver tentativas, aguardar com backoff
            if (attempt < retries) {
                const nextDelay = delay * Math.pow(2, attempt);

                if (onRetry) {
                    onRetry(attempt + 1, error, nextDelay);
                }

                await sleep(nextDelay);
            }
        }
    }

    throw lastError;
}
