/**
 * Circuit Breaker para AE0
 * Implementa o padrão Circuit Breaker para proteção contra falhas em cascata
 *
 * Estados:
 * - CLOSED: Operação normal, requisições passam
 * - OPEN: Circuito aberto, requisições são rejeitadas imediatamente
 * - HALF_OPEN: Teste de recuperação, permite algumas requisições
 */

import { getEventBus, EventBus } from '../event-stream/event-bus';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Nome do circuito (para identificação) */
  name: string;
  /** Número de falhas antes de abrir o circuito */
  failureThreshold?: number;
  /** Número de sucessos em half-open para fechar */
  successThreshold?: number;
  /** Tempo em ms para tentar recuperação (half-open) */
  resetTimeoutMs?: number;
  /** Tempo em ms para considerar uma operação como timeout */
  operationTimeoutMs?: number;
  /** Callback quando o estado muda */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback quando uma operação falha */
  onFailure?: (error: Error) => void;
  /** Habilitar eventos no EventBus */
  enableEvents?: boolean;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  totalRejected: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  lastStateChange?: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker com suporte a modos lite/fullstack
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalRejected = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private lastStateChange?: number;
  private resetTimer?: NodeJS.Timeout;
  private eventBus?: EventBus;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly operationTimeoutMs: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
  private readonly onFailure?: (error: Error) => void;
  private readonly enableEvents: boolean;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000; // 30s
    this.operationTimeoutMs = options.operationTimeoutMs ?? 10000; // 10s
    this.onStateChange = options.onStateChange;
    this.onFailure = options.onFailure;
    this.enableEvents = options.enableEvents ?? false;

    if (this.enableEvents) {
      try {
        this.eventBus = getEventBus();
      } catch {
        // Event bus não inicializado
      }
    }
  }

  /**
   * Executa uma operação protegida pelo circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Verifica se pode executar
    if (!this.canExecute()) {
      this.totalRejected++;
      this.publishEvent('circuit.rejected', { reason: 'circuit_open' });
      throw new CircuitBreakerError(
        `Circuit "${this.name}" is ${this.state}`,
        this.name,
        this.state
      );
    }

    this.totalRequests++;
    const startTime = Date.now();

    try {
      // Executa com timeout
      const result = await this.executeWithTimeout(operation);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Executa operação com timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.operationTimeoutMs}ms`));
      }, this.operationTimeoutMs);

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
   * Verifica se uma operação pode ser executada
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half_open':
        // Em half-open, permitimos algumas requisições para teste
        return this.successes < this.successThreshold;
      default:
        return false;
    }
  }

  /**
   * Registra uma falha
   */
  recordFailure(error?: Error): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.onFailure && error) {
      this.onFailure(error);
    }

    this.publishEvent('circuit.failure', {
      failures: this.failures,
      threshold: this.failureThreshold,
      error: error?.message
    });

    if (this.state === 'half_open') {
      // Falha em half-open volta para open
      this.transitionTo('open');
    } else if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      // Atingiu threshold, abre o circuito
      this.transitionTo('open');
    }
  }

  /**
   * Registra um sucesso
   */
  recordSuccess(): void {
    this.successes++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    this.publishEvent('circuit.success', {
      successes: this.successes,
      threshold: this.successThreshold
    });

    if (this.state === 'half_open') {
      if (this.successes >= this.successThreshold) {
        // Recuperação completa
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      // Reset contador de falhas em operação normal
      this.failures = 0;
    }
  }

  /**
   * Transição de estado
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    this.lastStateChange = Date.now();

    // Reset contadores baseado no novo estado
    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
      this.clearResetTimer();
    } else if (newState === 'open') {
      this.successes = 0;
      this.scheduleReset();
    } else if (newState === 'half_open') {
      this.failures = 0;
      this.successes = 0;
    }

    // Callbacks
    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }

    this.publishEvent('circuit.state_change', {
      from: oldState,
      to: newState
    });

    console.log(`[AE0] Circuit "${this.name}": ${oldState} -> ${newState}`);
  }

  /**
   * Agenda tentativa de recuperação
   */
  private scheduleReset(): void {
    this.clearResetTimer();

    this.resetTimer = setTimeout(() => {
      if (this.state === 'open') {
        this.transitionTo('half_open');
      }
    }, this.resetTimeoutMs);
  }

  /**
   * Limpa timer de reset
   */
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  /**
   * Publica evento no EventBus
   */
  private publishEvent(type: string, data: Record<string, any>): void {
    if (this.eventBus) {
      this.eventBus.publish(type, {
        circuit: this.name,
        state: this.state,
        ...data
      }, {
        source: 'AE0/circuit-breaker',
        priority: type.includes('failure') || type.includes('state_change') ? 10 : 50
      });
    }
  }

  /**
   * Retorna o estado atual
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Retorna estatísticas
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalRejected: this.totalRejected,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * Reset manual do circuito
   */
  reset(): void {
    this.clearResetTimer();
    this.failures = 0;
    this.successes = 0;
    this.transitionTo('closed');
  }

  /**
   * Força abertura do circuito (para manutenção)
   */
  trip(): void {
    this.transitionTo('open');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearResetTimer();
  }
}

/**
 * Registry de Circuit Breakers
 */
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Obtém ou cria um circuit breaker
   */
  static getOrCreate(options: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(options.name);

    if (!breaker) {
      breaker = new CircuitBreaker(options);
      this.breakers.set(options.name, breaker);
    }

    return breaker;
  }

  /**
   * Obtém circuit breaker por nome
   */
  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Remove circuit breaker
   */
  static remove(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Retorna todos os circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Retorna estatísticas de todos os circuit breakers
   */
  static getAllStats(): CircuitBreakerStats[] {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  /**
   * Reseta todos os circuit breakers
   */
  static resetAll(): void {
    this.breakers.forEach(b => b.reset());
  }

  /**
   * Limpa o registry
   */
  static clear(): void {
    this.breakers.forEach(b => b.destroy());
    this.breakers.clear();
  }
}

/**
 * Factory para criar circuit breakers com configurações padrão
 */
export class CircuitBreakerFactory {
  /**
   * Cria circuit breaker para modo lite
   */
  static createLite(name: string): CircuitBreaker {
    return CircuitBreakerRegistry.getOrCreate({
      name,
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 15000, // 15s
      operationTimeoutMs: 5000, // 5s
      enableEvents: false
    });
  }

  /**
   * Cria circuit breaker para modo fullstack
   */
  static createFullstack(name: string, onStateChange?: (from: CircuitState, to: CircuitState) => void): CircuitBreaker {
    return CircuitBreakerRegistry.getOrCreate({
      name,
      failureThreshold: 5,
      successThreshold: 3,
      resetTimeoutMs: 30000, // 30s
      operationTimeoutMs: 10000, // 10s
      enableEvents: true,
      onStateChange
    });
  }

  /**
   * Cria circuit breaker para componentes críticos
   */
  static createCritical(name: string): CircuitBreaker {
    return CircuitBreakerRegistry.getOrCreate({
      name,
      failureThreshold: 2, // Abre rápido
      successThreshold: 5, // Recupera devagar
      resetTimeoutMs: 60000, // 1 min
      operationTimeoutMs: 15000, // 15s
      enableEvents: true
    });
  }
}

// CLI para testes
if (require.main === module) {
  console.log('[AE0] Testando Circuit Breaker...\n');

  async function runTests() {
    // Teste 1: Operação normal
    console.log('=== Teste 1: Operação Normal ===');
    const cb1 = CircuitBreakerFactory.createLite('test-normal');

    for (let i = 0; i < 5; i++) {
      try {
        await cb1.execute(async () => {
          return `Sucesso ${i + 1}`;
        });
        console.log(`  Operação ${i + 1}: OK`);
      } catch (error) {
        console.log(`  Operação ${i + 1}: ERRO`);
      }
    }
    console.log('  Stats:', cb1.getStats());

    // Teste 2: Falhas e abertura do circuito
    console.log('\n=== Teste 2: Falhas e Abertura ===');
    const cb2 = new CircuitBreaker({
      name: 'test-failures',
      failureThreshold: 3,
      resetTimeoutMs: 2000, // 2s para teste rápido
      onStateChange: (from, to) => {
        console.log(`  Estado: ${from} -> ${to}`);
      }
    });

    for (let i = 0; i < 5; i++) {
      try {
        await cb2.execute(async () => {
          throw new Error(`Falha simulada ${i + 1}`);
        });
      } catch (error) {
        console.log(`  Operação ${i + 1}: ${(error as Error).message}`);
      }
    }
    console.log('  Stats:', cb2.getStats());

    // Teste 3: Recuperação half-open
    console.log('\n=== Teste 3: Recuperação ===');
    console.log('  Aguardando reset timeout (2s)...');

    await new Promise(resolve => setTimeout(resolve, 2500));

    console.log(`  Estado atual: ${cb2.getState()}`);

    // Tentar operações bem-sucedidas
    for (let i = 0; i < 4; i++) {
      try {
        await cb2.execute(async () => {
          return `Recuperação ${i + 1}`;
        });
        console.log(`  Operação ${i + 1}: OK (${cb2.getState()})`);
      } catch (error) {
        console.log(`  Operação ${i + 1}: ${(error as Error).message}`);
      }
    }
    console.log('  Stats finais:', cb2.getStats());

    // Cleanup
    CircuitBreakerRegistry.clear();

    console.log('\n[AE0] ✓ Circuit Breaker testado com sucesso');
  }

  runTests().catch(console.error);
}
