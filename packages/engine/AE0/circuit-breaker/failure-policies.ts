/**
 * Failure Policies para AE0
 * Define políticas de tratamento de falhas e estratégias de recuperação
 */

import { CircuitBreaker, CircuitState, CircuitBreakerFactory } from './circuit-breaker';

export type FailureAction = 'fail_fast' | 'graceful_degradation' | 'retry' | 'fallback';

export interface RetryOptions {
  /** Número máximo de tentativas */
  maxAttempts: number;
  /** Delay inicial entre tentativas (ms) */
  initialDelayMs: number;
  /** Fator de multiplicação para backoff exponencial */
  backoffMultiplier: number;
  /** Delay máximo entre tentativas (ms) */
  maxDelayMs: number;
  /** Adicionar jitter aleatório */
  jitter: boolean;
}

export interface FailurePolicyConfig {
  /** Ação padrão em caso de falha */
  action: FailureAction;
  /** Configurações de retry (se action = 'retry') */
  retry?: RetryOptions;
  /** Função de fallback (se action = 'fallback') */
  fallback?: <T>() => T | Promise<T>;
  /** Timeout para operações (ms) */
  timeoutMs?: number;
  /** Habilitar circuit breaker */
  circuitBreaker?: boolean;
  /** Nome do circuit breaker */
  circuitBreakerName?: string;
}

/**
 * Configurações padrão por modo
 */
const DEFAULT_POLICIES: Record<'lite' | 'fullstack', FailurePolicyConfig> = {
  lite: {
    action: 'fail_fast',
    timeoutMs: 5000,
    circuitBreaker: true
  },
  fullstack: {
    action: 'graceful_degradation',
    retry: {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
      jitter: true
    },
    timeoutMs: 10000,
    circuitBreaker: true
  }
};

/**
 * Seleciona a ação de falha baseada no modo
 */
export function selectFailureAction(mode: 'lite' | 'fullstack'): FailureAction {
  return DEFAULT_POLICIES[mode].action;
}

/**
 * Retorna a política padrão para o modo
 */
export function getDefaultPolicy(mode: 'lite' | 'fullstack'): FailurePolicyConfig {
  return { ...DEFAULT_POLICIES[mode] };
}

/**
 * Calcula delay com backoff exponencial
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions
): number {
  let delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  delay = Math.min(delay, options.maxDelayMs);

  if (options.jitter) {
    // Adiciona até 25% de variação
    const jitterRange = delay * 0.25;
    delay += Math.random() * jitterRange - jitterRange / 2;
  }

  return Math.round(delay);
}

/**
 * Executor com políticas de falha
 */
export class FailurePolicyExecutor {
  private circuitBreaker?: CircuitBreaker;
  private readonly config: FailurePolicyConfig;

  constructor(config: Partial<FailurePolicyConfig> = {}, mode: 'lite' | 'fullstack' = 'lite') {
    this.config = { ...getDefaultPolicy(mode), ...config };

    if (this.config.circuitBreaker) {
      const name = this.config.circuitBreakerName || `policy-${Date.now()}`;
      this.circuitBreaker = mode === 'lite'
        ? CircuitBreakerFactory.createLite(name)
        : CircuitBreakerFactory.createFullstack(name);
    }
  }

  /**
   * Executa operação com política de falha
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Se tem circuit breaker, usar
    if (this.circuitBreaker) {
      return this.executeWithCircuitBreaker(operation);
    }

    // Execução direta com política
    return this.executeWithPolicy(operation);
  }

  /**
   * Executa com circuit breaker
   */
  private async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.circuitBreaker!.execute(async () => {
        return this.executeWithPolicy(operation);
      });
    } catch (error) {
      // Se circuito aberto e tem fallback
      if (
        this.config.action === 'fallback' &&
        this.config.fallback &&
        this.circuitBreaker!.getState() === 'open'
      ) {
        return this.config.fallback<T>();
      }
      throw error;
    }
  }

  /**
   * Executa com política específica
   */
  private async executeWithPolicy<T>(operation: () => Promise<T>): Promise<T> {
    switch (this.config.action) {
      case 'fail_fast':
        return this.executeFailFast(operation);

      case 'retry':
        return this.executeWithRetry(operation);

      case 'graceful_degradation':
        return this.executeGracefulDegradation(operation);

      case 'fallback':
        return this.executeWithFallback(operation);

      default:
        return operation();
    }
  }

  /**
   * Fail fast: executa uma vez, falha imediatamente
   */
  private async executeFailFast<T>(operation: () => Promise<T>): Promise<T> {
    return this.executeWithTimeout(operation);
  }

  /**
   * Retry: tenta múltiplas vezes com backoff
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    const retryConfig = this.config.retry!;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await this.executeWithTimeout(operation);
      } catch (error) {
        lastError = error as Error;
        console.log(`[AE0] Attempt ${attempt}/${retryConfig.maxAttempts} failed: ${lastError.message}`);

        if (attempt < retryConfig.maxAttempts) {
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.log(`[AE0] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Graceful degradation: tenta, mas aceita resultado parcial
   */
  private async executeGracefulDegradation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.executeWithRetry(operation);
    } catch (error) {
      // Se tem fallback, usar
      if (this.config.fallback) {
        console.log('[AE0] Using fallback due to degradation');
        return this.config.fallback<T>();
      }
      throw error;
    }
  }

  /**
   * Fallback: tenta operação, usa fallback em caso de falha
   */
  private async executeWithFallback<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.executeWithTimeout(operation);
    } catch (error) {
      if (this.config.fallback) {
        console.log('[AE0] Primary operation failed, using fallback');
        return this.config.fallback<T>();
      }
      throw error;
    }
  }

  /**
   * Executa com timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.timeoutMs) {
      return operation();
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retorna estatísticas do circuit breaker
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker?.getStats();
  }

  /**
   * Retorna estado do circuit breaker
   */
  getCircuitState(): CircuitState | undefined {
    return this.circuitBreaker?.getState();
  }
}

/**
 * Decorator para adicionar política de falha a funções
 */
export function withFailurePolicy<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config?: Partial<FailurePolicyConfig>,
  mode: 'lite' | 'fullstack' = 'lite'
): T {
  const executor = new FailurePolicyExecutor(config, mode);

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return executor.execute(() => fn(...args));
  }) as T;
}

/**
 * Bulkhead: limita execuções concorrentes
 */
export class Bulkhead {
  private running = 0;
  private queue: Array<{
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number = 100
  ) {}

  /**
   * Adquire permissão para executar
   */
  async acquire(): Promise<boolean> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return true;
    }

    if (this.queue.length >= this.maxQueue) {
      throw new Error('Bulkhead queue full');
    }

    return new Promise<boolean>((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  /**
   * Libera permissão
   */
  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.resolve(true);
    } else {
      this.running = Math.max(0, this.running - 1);
    }
  }

  /**
   * Executa com bulkhead
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    return {
      running: this.running,
      maxConcurrent: this.maxConcurrent,
      queued: this.queue.length,
      maxQueue: this.maxQueue
    };
  }
}

// CLI para testes
if (require.main === module) {
  console.log('[AE0] Testando Failure Policies...\n');

  async function runTests() {
    // Teste 1: Retry com backoff
    console.log('=== Teste 1: Retry com Backoff ===');
    const executor1 = new FailurePolicyExecutor({
      action: 'retry',
      retry: {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        maxDelayMs: 1000,
        jitter: true
      }
    }, 'fullstack');

    let attempts = 0;
    try {
      await executor1.execute(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Falha ${attempts}`);
        }
        return `Sucesso na tentativa ${attempts}`;
      });
      console.log(`  Sucesso após ${attempts} tentativas`);
    } catch (error) {
      console.log(`  Falha: ${(error as Error).message}`);
    }

    // Teste 2: Fallback
    console.log('\n=== Teste 2: Fallback ===');
    const executor2 = new FailurePolicyExecutor({
      action: 'fallback',
      fallback: () => 'Valor de fallback'
    }, 'lite');

    const result = await executor2.execute(async () => {
      throw new Error('Falha intencional');
    });
    console.log(`  Resultado: ${result}`);

    // Teste 3: Bulkhead
    console.log('\n=== Teste 3: Bulkhead ===');
    const bulkhead = new Bulkhead(2, 5);

    const tasks = Array.from({ length: 5 }, (_, i) => async () => {
      console.log(`  Task ${i + 1} iniciada`);
      await new Promise(r => setTimeout(r, 100));
      console.log(`  Task ${i + 1} finalizada`);
      return i + 1;
    });

    const results = await Promise.all(
      tasks.map(task => bulkhead.execute(task))
    );
    console.log(`  Resultados: ${results.join(', ')}`);
    console.log('  Stats:', bulkhead.getStats());

    console.log('\n[AE0] ✓ Failure Policies testadas com sucesso');
  }

  runTests().catch(console.error);
}
