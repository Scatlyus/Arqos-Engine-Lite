/**
 * Health Monitor para AE0
 * Sistema de monitoramento de saúde dos componentes do Arqos Engine
 */

import { CircuitBreakerRegistry, CircuitBreakerStats } from '../AE0/circuit-breaker/circuit-breaker';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  lastCheck: number;
  responseTimeMs?: number;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  components: Record<string, ComponentHealth>;
  memory: MemoryHealth;
  circuitBreakers: CircuitBreakerStats[];
}

export interface MemoryHealth {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  usedPercent: number;
  status: HealthStatus;
}

export interface HealthCheckConfig {
  /** Nome do componente */
  name: string;
  /** Função de verificação */
  check: () => Promise<HealthCheckResult>;
  /** Intervalo de verificação em ms */
  intervalMs?: number;
  /** Timeout para verificação em ms */
  timeoutMs?: number;
  /** Crítico para o sistema */
  critical?: boolean;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}

export interface HealthMonitorOptions {
  /** Intervalo padrão de verificação em ms */
  defaultIntervalMs?: number;
  /** Limite de memória em MB para considerar degraded */
  memoryWarningMb?: number;
  /** Limite de memória em MB para considerar unhealthy */
  memoryCriticalMb?: number;
  /** Callback quando status muda */
  onStatusChange?: (component: string, oldStatus: HealthStatus, newStatus: HealthStatus) => void;
  /** Habilitar logs */
  enableLogs?: boolean;
}

/**
 * Health Monitor principal
 */
export class HealthMonitor {
  private checks = new Map<string, HealthCheckConfig>();
  private results = new Map<string, ComponentHealth>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private startTime: number;
  private running = false;

  private readonly defaultIntervalMs: number;
  private readonly memoryWarningMb: number;
  private readonly memoryCriticalMb: number;
  private readonly onStatusChange?: (component: string, oldStatus: HealthStatus, newStatus: HealthStatus) => void;
  private readonly enableLogs: boolean;

  constructor(options: HealthMonitorOptions = {}) {
    this.defaultIntervalMs = options.defaultIntervalMs ?? 10000; // 10s
    this.memoryWarningMb = options.memoryWarningMb ?? 500; // 500MB
    this.memoryCriticalMb = options.memoryCriticalMb ?? 1000; // 1GB
    this.onStatusChange = options.onStatusChange;
    this.enableLogs = options.enableLogs ?? true;
    this.startTime = Date.now();
  }

  /**
   * Registra um health check
   */
  registerCheck(config: HealthCheckConfig): void {
    this.checks.set(config.name, {
      ...config,
      intervalMs: config.intervalMs ?? this.defaultIntervalMs,
      timeoutMs: config.timeoutMs ?? 5000,
      critical: config.critical ?? false
    });

    // Inicializa resultado como unknown
    this.results.set(config.name, {
      name: config.name,
      status: 'unknown',
      lastCheck: 0
    });

    this.log(`Registered health check: ${config.name}`);
  }

  /**
   * Remove um health check
   */
  unregisterCheck(name: string): boolean {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    this.results.delete(name);
    return this.checks.delete(name);
  }

  /**
   * Inicia o monitoramento
   */
  start(): void {
    if (this.running) {
      this.log('Health monitor already running');
      return;
    }

    this.running = true;
    this.startTime = Date.now();

    // Executa primeira verificação imediatamente
    this.runAllChecks();

    // Agenda verificações periódicas
    for (const [name, config] of this.checks) {
      const interval = setInterval(() => {
        this.runCheck(name);
      }, config.intervalMs);
      this.intervals.set(name, interval);
    }

    this.log('Health monitor started');
  }

  /**
   * Para o monitoramento
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();

    this.log('Health monitor stopped');
  }

  /**
   * Executa todas as verificações
   */
  async runAllChecks(): Promise<void> {
    const promises = Array.from(this.checks.keys()).map(name => this.runCheck(name));
    await Promise.all(promises);
  }

  /**
   * Executa uma verificação específica
   */
  async runCheck(name: string): Promise<ComponentHealth | undefined> {
    const config = this.checks.get(name);
    if (!config) return undefined;

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Executa com timeout
      result = await this.executeWithTimeout(config.check, config.timeoutMs!);
    } catch (error) {
      result = {
        status: 'unhealthy',
        message: (error as Error).message
      };
    }

    const responseTimeMs = Date.now() - startTime;
    const oldResult = this.results.get(name);
    const oldStatus = oldResult?.status ?? 'unknown';

    const health: ComponentHealth = {
      name,
      status: result.status,
      message: result.message,
      lastCheck: Date.now(),
      responseTimeMs,
      metadata: result.metadata
    };

    this.results.set(name, health);

    // Notifica mudança de status
    if (oldStatus !== result.status && this.onStatusChange) {
      this.onStatusChange(name, oldStatus, result.status);
    }

    if (result.status !== 'healthy') {
      this.log(`[${name}] Status: ${result.status} - ${result.message || 'No message'}`);
    }

    return health;
  }

  /**
   * Executa função com timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
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
   * Retorna saúde de um componente
   */
  getComponentHealth(name: string): ComponentHealth | undefined {
    return this.results.get(name);
  }

  /**
   * Retorna saúde da memória
   */
  getMemoryHealth(): MemoryHealth {
    const usage = process.memoryUsage();
    const heapUsedMb = usage.heapUsed / 1024 / 1024;
    const heapTotalMb = usage.heapTotal / 1024 / 1024;
    const usedPercent = (heapUsedMb / heapTotalMb) * 100;

    let status: HealthStatus = 'healthy';
    if (heapUsedMb >= this.memoryCriticalMb) {
      status = 'unhealthy';
    } else if (heapUsedMb >= this.memoryWarningMb) {
      status = 'degraded';
    }

    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(heapTotalMb),
      heapUsed: Math.round(heapUsedMb),
      external: Math.round(usage.external / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
      usedPercent: Math.round(usedPercent * 100) / 100,
      status
    };
  }

  /**
   * Retorna saúde geral do sistema
   */
  getSystemHealth(): SystemHealth {
    const components: Record<string, ComponentHealth> = {};
    let overallStatus: HealthStatus = 'healthy';

    for (const [name, health] of this.results) {
      components[name] = health;

      const config = this.checks.get(name);
      if (config?.critical && health.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (health.status === 'unhealthy' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      } else if (health.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    const memory = this.getMemoryHealth();
    if (memory.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (memory.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      components,
      memory,
      circuitBreakers: CircuitBreakerRegistry.getAllStats()
    };
  }

  /**
   * Verifica se o sistema está saudável
   */
  isHealthy(): boolean {
    const health = this.getSystemHealth();
    return health.status === 'healthy';
  }

  /**
   * Log helper
   */
  private log(message: string): void {
    if (this.enableLogs) {
      console.log(`[Health] ${message}`);
    }
  }
}

// Singleton global
let healthMonitor: HealthMonitor | null = null;

/**
 * Inicializa o Health Monitor global
 */
export function initializeHealthMonitor(options?: HealthMonitorOptions): HealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new HealthMonitor(options);
  }
  return healthMonitor;
}

/**
 * Retorna o Health Monitor global
 */
export function getHealthMonitor(): HealthMonitor {
  if (!healthMonitor) {
    throw new Error('Health monitor not initialized');
  }
  return healthMonitor;
}

/**
 * Registra health checks padrão do Arqos Engine
 */
export function registerDefaultChecks(monitor: HealthMonitor): void {
  // Check de memória
  monitor.registerCheck({
    name: 'memory',
    check: async () => {
      const health = monitor.getMemoryHealth();
      return {
        status: health.status,
        message: `Heap: ${health.heapUsed}MB / ${health.heapTotal}MB (${health.usedPercent}%)`,
        metadata: health
      };
    },
    intervalMs: 30000, // 30s
    critical: true
  });

  // Check do Event Loop
  monitor.registerCheck({
    name: 'event-loop',
    check: async () => {
      const start = process.hrtime.bigint();
      await new Promise(resolve => setImmediate(resolve));
      const lagNs = Number(process.hrtime.bigint() - start);
      const lagMs = lagNs / 1_000_000;

      let status: HealthStatus = 'healthy';
      if (lagMs > 100) status = 'unhealthy';
      else if (lagMs > 50) status = 'degraded';

      return {
        status,
        message: `Event loop lag: ${lagMs.toFixed(2)}ms`,
        metadata: { lagMs }
      };
    },
    intervalMs: 5000, // 5s
    critical: true
  });

  // Check de Circuit Breakers
  monitor.registerCheck({
    name: 'circuit-breakers',
    check: async () => {
      const stats = CircuitBreakerRegistry.getAllStats();
      const openCircuits = stats.filter(s => s.state === 'open');

      let status: HealthStatus = 'healthy';
      let message = `${stats.length} circuits registered`;

      if (openCircuits.length > 0) {
        status = 'degraded';
        message = `${openCircuits.length} circuit(s) open: ${openCircuits.map(s => s.name).join(', ')}`;
      }

      return {
        status,
        message,
        metadata: { total: stats.length, open: openCircuits.length }
      };
    },
    intervalMs: 10000, // 10s
    critical: false
  });
}

/**
 * Wrapper para compatibilidade com versão anterior
 */
export function startHealthMonitoring(): void {
  const monitor = initializeHealthMonitor({
    enableLogs: true
  });
  registerDefaultChecks(monitor);
  monitor.start();
}

// CLI para testes
if (require.main === module) {
  console.log('[Health] Testando Health Monitor...\n');

  async function runTests() {
    const monitor = new HealthMonitor({
      defaultIntervalMs: 2000,
      enableLogs: true,
      onStatusChange: (component, oldStatus, newStatus) => {
        console.log(`  Status change: ${component} ${oldStatus} -> ${newStatus}`);
      }
    });

    // Registrar checks de teste
    monitor.registerCheck({
      name: 'test-healthy',
      check: async () => ({
        status: 'healthy',
        message: 'Always healthy'
      }),
      intervalMs: 1000
    });

    let degradedCount = 0;
    monitor.registerCheck({
      name: 'test-degraded',
      check: async () => {
        degradedCount++;
        return {
          status: degradedCount % 3 === 0 ? 'degraded' : 'healthy',
          message: `Check #${degradedCount}`
        };
      },
      intervalMs: 1000
    });

    // Registrar checks padrão
    registerDefaultChecks(monitor);

    // Iniciar
    monitor.start();

    // Aguardar algumas verificações
    console.log('=== Aguardando 5 segundos ===');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Mostrar resultados
    console.log('\n=== Sistema Health ===');
    const health = monitor.getSystemHealth();
    console.log(`Status: ${health.status}`);
    console.log(`Uptime: ${health.uptime}ms`);
    console.log(`Memory: ${health.memory.heapUsed}MB / ${health.memory.heapTotal}MB`);
    console.log('\nComponentes:');
    for (const [name, comp] of Object.entries(health.components)) {
      console.log(`  ${name}: ${comp.status} (${comp.responseTimeMs}ms) - ${comp.message}`);
    }

    // Parar
    monitor.stop();

    console.log('\n[Health] ✓ Health Monitor testado com sucesso');
  }

  runTests().catch(console.error);
}
