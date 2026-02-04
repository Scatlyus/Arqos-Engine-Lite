/**
 * Distributed Execution Manager - Módulo M4 do AE2
 * Responsável por execução distribuída, load balancing e dispatch de agentes
 */

import type {
  OrchestrationPlan,
  ExecutionStep,
  Agent,
  ExecutionOutcome,
  ExecutionError,
  ModuleStatus
} from '../../types';

// ========== Configurações ==========

interface DistributedExecutionConfig {
  /** Número máximo de execuções paralelas */
  maxParallelExecutions: number;
  /** Threshold de carga para considerar agente sobrecarregado (0-100) */
  loadThreshold: number;
  /** Intervalo de health check em ms */
  healthCheckInterval: number;
  /** Timeout padrão de execução em ms */
  defaultExecutionTimeout: number;
  /** Habilitar rebalanceamento automático */
  enableAutoRebalance: boolean;
  /** Número máximo de retries por task */
  maxRetries: number;
  /** Fator de backoff exponencial */
  backoffFactor: number;
}

const DEFAULT_CONFIG: DistributedExecutionConfig = {
  maxParallelExecutions: 10,
  loadThreshold: 80,
  healthCheckInterval: 5000,
  defaultExecutionTimeout: 30000,
  enableAutoRebalance: true,
  maxRetries: 3,
  backoffFactor: 1.5
};

// ========== Tipos Internos ==========

interface AgentSnapshot {
  id: string;
  name: string;
  load: number;
  status: 'available' | 'busy' | 'offline' | 'overloaded';
  activeExecutions: number;
  capabilities: string[];
  metrics: AgentPerformanceMetrics;
  lastHealthCheck: number;
}

interface AgentPerformanceMetrics {
  avgResponseTime: number;
  successRate: number;
  totalExecutions: number;
  failedExecutions: number;
  lastExecutionTime?: number;
}

interface ExecutionTask {
  id: string;
  stepId: string;
  planId: string;
  assignedAgent?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  retryCount: number;
  startedAt?: number;
  completedAt?: number;
  error?: ExecutionError;
  result?: unknown;
}

interface DispatchResult {
  assignments: Map<string, ExecutionTask[]>;
  unassigned: ExecutionTask[];
  balanceScore: number;
}

interface LoadBalanceStrategy {
  type: 'round_robin' | 'least_loaded' | 'capability_match' | 'performance_based';
  weights?: Record<string, number>;
}

// ========== Classe Principal ==========

export class DistributedExecutionManager {
  private config: DistributedExecutionConfig;
  private initialized = false;
  private lastActivity?: number;

  // Estado interno
  private agents: Map<string, AgentSnapshot> = new Map();
  private executionQueue: ExecutionTask[] = [];
  private activeExecutions: Map<string, ExecutionTask> = new Map();
  private completedExecutions: ExecutionTask[] = [];

  // Métricas
  private totalDispatches = 0;
  private successfulExecutions = 0;
  private failedExecutions = 0;
  private rebalanceCount = 0;

  constructor(config: Partial<DistributedExecutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M4] Distributed Execution Manager initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M4] Distributed Execution Manager initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'DistributedExecutionManager',
      initialized: this.initialized,
      healthy: this.initialized && this.agents.size > 0,
      lastActivity: this.lastActivity,
      stats: {
        totalDispatches: this.totalDispatches,
        successfulExecutions: this.successfulExecutions,
        failedExecutions: this.failedExecutions,
        activeExecutions: this.activeExecutions.size,
        queuedTasks: this.executionQueue.length,
        registeredAgents: this.agents.size,
        rebalanceCount: this.rebalanceCount
      }
    };
  }

  // ========== Gerenciamento de Agentes ==========

  /**
   * Registra um agente para execução distribuída
   */
  registerAgent(agent: Agent): void {
    const snapshot: AgentSnapshot = {
      id: agent.id,
      name: agent.name || agent.id,
      load: agent.load ?? 0,
      status: this.mapAgentStatus(agent),
      activeExecutions: 0,
      capabilities: agent.capabilities || [],
      metrics: {
        avgResponseTime: agent.metrics?.avgResponseTime ?? 0,
        successRate: agent.metrics?.successRate ?? 1,
        totalExecutions: agent.metrics?.totalExecutions ?? 0,
        failedExecutions: 0
      },
      lastHealthCheck: Date.now()
    };

    this.agents.set(agent.id, snapshot);
    console.log(`[AE2:M4] Agent registered: ${agent.id} (load: ${snapshot.load}%)`);
  }

  /**
   * Atualiza o status de um agente
   */
  updateAgentStatus(agentId: string, updates: Partial<AgentSnapshot>): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    Object.assign(agent, updates);
    agent.lastHealthCheck = Date.now();

    // Verificar se está sobrecarregado
    if (agent.load >= this.config.loadThreshold) {
      agent.status = 'overloaded';
    }
  }

  /**
   * Remove um agente do pool
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    console.log(`[AE2:M4] Agent unregistered: ${agentId}`);
  }

  /**
   * Obtém snapshot de todos os agentes
   */
  getAgentSnapshots(): AgentSnapshot[] {
    return Array.from(this.agents.values());
  }

  // ========== Execução de Planos ==========

  /**
   * Executa um plano de orquestração de forma distribuída
   */
  async executePlan(plan: OrchestrationPlan): Promise<ExecutionOutcome> {
    console.log(`[AE2:M4] Executing plan ${plan.id}...`);
    this.lastActivity = Date.now();
    this.totalDispatches++;

    const startTime = Date.now();
    const tasks = this.createTasksFromPlan(plan);
    const errors: ExecutionError[] = [];
    let stepsCompleted = 0;

    // Registrar agentes do plano se não existirem
    for (const agent of plan.agents) {
      if (!this.agents.has(agent.id)) {
        this.registerAgent(agent);
      }
    }

    // Dispatch inicial
    const dispatch = this.dispatchTasks(tasks, { type: 'performance_based' });

    // Executar tasks
    for (const [agentId, agentTasks] of dispatch.assignments) {
      for (const task of agentTasks) {
        try {
          await this.executeTask(task, agentId);
          stepsCompleted++;
          this.successfulExecutions++;
        } catch (error) {
          const execError = this.createExecutionError(task, error);
          errors.push(execError);
          this.failedExecutions++;

          // Verificar política de falha
          const step = plan.steps.find(s => s.id === task.stepId);
          if (step?.onFailure === 'abort') {
            break;
          }
        }
      }
    }

    // Processar tasks não atribuídas
    for (const task of dispatch.unassigned) {
      errors.push({
        stepId: task.stepId,
        code: 'UNASSIGNED',
        message: 'No available agent to execute task',
        recoverable: true
      });
    }

    const endTime = Date.now();
    const status = this.determineOutcomeStatus(stepsCompleted, plan.steps.length, errors);

    const outcome: ExecutionOutcome = {
      id: `outcome_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      planId: plan.id,
      decisionId: plan.decisionId,
      status,
      duration: endTime - startTime,
      stepsCompleted,
      stepsTotal: plan.steps.length,
      errors,
      startedAt: startTime,
      completedAt: endTime
    };

    console.log(`[AE2:M4] Plan execution completed: ${status} (${stepsCompleted}/${plan.steps.length} steps)`);
    return outcome;
  }

  /**
   * Otimiza a distribuição de um plano
   */
  async optimizePlan(plan: OrchestrationPlan): Promise<OrchestrationPlan> {
    console.log(`[AE2:M4] Optimizing plan distribution for ${plan.id}...`);
    this.lastActivity = Date.now();

    // Obter snapshots atuais dos agentes
    const availableAgents = this.getAvailableAgents();

    // Calcular distribuição ótima
    const optimalDistribution = this.calculateOptimalDistribution(
      plan.steps,
      availableAgents
    );

    // Atualizar steps com agentes atribuídos
    const optimizedSteps = plan.steps.map(step => {
      const assignment = optimalDistribution.get(step.id);
      if (assignment) {
        return {
          ...step,
          params: {
            ...step.params,
            assignedAgent: assignment
          }
        };
      }
      return step;
    });

    // Recalcular métricas baseado na distribuição
    const avgLoad = this.calculateAverageLoad(optimalDistribution, availableAgents);
    const parallelism = this.calculateEffectiveParallelism(optimalDistribution);

    return {
      ...plan,
      steps: optimizedSteps,
      expectedMetrics: {
        ...plan.expectedMetrics,
        parallelism
      }
    };
  }

  // ========== Load Balancing ==========

  /**
   * Executa balanceamento de carga entre agentes
   */
  balanceLoad(): AgentSnapshot[] {
    console.log('[AE2:M4] Rebalancing load across agents...');
    this.rebalanceCount++;

    const agents = Array.from(this.agents.values())
      .filter(a => a.status !== 'offline');

    if (agents.length === 0) return [];

    // Calcular carga média
    const avgLoad = agents.reduce((sum, a) => sum + a.load, 0) / agents.length;

    // Identificar agentes sobrecarregados e subcarregados
    const overloaded = agents.filter(a => a.load > avgLoad + 20);
    const underloaded = agents.filter(a => a.load < avgLoad - 20);

    // Simular rebalanceamento (ajustar cargas)
    for (const agent of agents) {
      const targetLoad = (agent.load + avgLoad) / 2;
      agent.load = Number(targetLoad.toFixed(2));

      // Atualizar status baseado na nova carga
      if (agent.load >= this.config.loadThreshold) {
        agent.status = 'overloaded';
      } else if (agent.load > 0) {
        agent.status = 'busy';
      } else {
        agent.status = 'available';
      }
    }

    console.log(`[AE2:M4] Rebalance complete: avg load = ${avgLoad.toFixed(1)}%`);
    return agents;
  }

  /**
   * Dispatch de tasks para agentes
   */
  dispatchTasks(
    tasks: ExecutionTask[],
    strategy: LoadBalanceStrategy
  ): DispatchResult {
    const assignments = new Map<string, ExecutionTask[]>();
    const unassigned: ExecutionTask[] = [];
    const availableAgents = this.getAvailableAgents();

    if (availableAgents.length === 0) {
      return {
        assignments,
        unassigned: tasks,
        balanceScore: 0
      };
    }

    // Inicializar assignments
    for (const agent of availableAgents) {
      assignments.set(agent.id, []);
    }

    // Dispatch baseado na estratégia
    for (const task of tasks) {
      const selectedAgent = this.selectAgent(task, availableAgents, strategy);

      if (selectedAgent) {
        assignments.get(selectedAgent.id)!.push(task);
        task.assignedAgent = selectedAgent.id;

        // Atualizar carga do agente
        selectedAgent.activeExecutions++;
        selectedAgent.load = Math.min(100, selectedAgent.load + 10);
      } else {
        unassigned.push(task);
      }
    }

    // Calcular score de balanceamento
    const balanceScore = this.calculateBalanceScore(assignments, availableAgents);

    return { assignments, unassigned, balanceScore };
  }

  // ========== Health Checks ==========

  /**
   * Executa health check em todos os agentes
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const now = Date.now();

    for (const [id, agent] of this.agents) {
      // Verificar timeout de health check
      const timeSinceLastCheck = now - agent.lastHealthCheck;

      if (timeSinceLastCheck > this.config.healthCheckInterval * 3) {
        agent.status = 'offline';
        results.set(id, false);
      } else {
        // Simular health check
        const healthy = agent.status !== 'offline' && agent.load < 100;
        agent.lastHealthCheck = now;
        results.set(id, healthy);
      }
    }

    return results;
  }

  // ========== Métodos Privados ==========

  private mapAgentStatus(agent: Agent): AgentSnapshot['status'] {
    if (agent.status === 'offline') return 'offline';
    if ((agent.load ?? 0) >= this.config.loadThreshold) return 'overloaded';
    if (agent.status === 'busy') return 'busy';
    return 'available';
  }

  private createTasksFromPlan(plan: OrchestrationPlan): ExecutionTask[] {
    return plan.steps.map(step => ({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      stepId: step.id,
      planId: plan.id,
      status: 'pending',
      retryCount: 0
    }));
  }

  private getAvailableAgents(): AgentSnapshot[] {
    return Array.from(this.agents.values())
      .filter(a => a.status === 'available' || a.status === 'busy')
      .filter(a => a.load < this.config.loadThreshold)
      .filter(a => a.activeExecutions < this.config.maxParallelExecutions);
  }

  private selectAgent(
    task: ExecutionTask,
    agents: AgentSnapshot[],
    strategy: LoadBalanceStrategy
  ): AgentSnapshot | null {
    if (agents.length === 0) return null;

    switch (strategy.type) {
      case 'round_robin':
        return this.selectRoundRobin(agents);

      case 'least_loaded':
        return this.selectLeastLoaded(agents);

      case 'capability_match':
        return this.selectByCapability(task, agents);

      case 'performance_based':
        return this.selectByPerformance(agents);

      default:
        return this.selectLeastLoaded(agents);
    }
  }

  private selectRoundRobin(agents: AgentSnapshot[]): AgentSnapshot {
    // Selecionar agente com menos execuções ativas (simula round robin)
    return agents.reduce((prev, curr) =>
      curr.activeExecutions < prev.activeExecutions ? curr : prev
    );
  }

  private selectLeastLoaded(agents: AgentSnapshot[]): AgentSnapshot {
    return agents.reduce((prev, curr) =>
      curr.load < prev.load ? curr : prev
    );
  }

  private selectByCapability(
    task: ExecutionTask,
    agents: AgentSnapshot[]
  ): AgentSnapshot | null {
    // Por enquanto, retorna o menos carregado
    // TODO: Implementar matching de capabilities
    return this.selectLeastLoaded(agents);
  }

  private selectByPerformance(agents: AgentSnapshot[]): AgentSnapshot {
    // Score = successRate / (load + 1) * (1 / avgResponseTime + 1)
    return agents.reduce((prev, curr) => {
      const prevScore = this.calculatePerformanceScore(prev);
      const currScore = this.calculatePerformanceScore(curr);
      return currScore > prevScore ? curr : prev;
    });
  }

  private calculatePerformanceScore(agent: AgentSnapshot): number {
    const loadFactor = 1 / (agent.load + 1);
    const successFactor = agent.metrics.successRate;
    const responseFactor = 1 / (agent.metrics.avgResponseTime + 100);

    return loadFactor * successFactor * responseFactor * 1000;
  }

  private async executeTask(task: ExecutionTask, agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    task.status = 'running';
    task.startedAt = Date.now();
    this.activeExecutions.set(task.id, task);

    // Simular execução
    const executionTime = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, Math.min(executionTime, 100)));

    // Simular sucesso (90% chance)
    const success = Math.random() > 0.1;

    task.completedAt = Date.now();
    this.activeExecutions.delete(task.id);

    // Atualizar métricas do agente
    agent.activeExecutions = Math.max(0, agent.activeExecutions - 1);
    agent.metrics.totalExecutions++;
    agent.metrics.lastExecutionTime = task.completedAt - task.startedAt!;
    agent.metrics.avgResponseTime = (
      agent.metrics.avgResponseTime * (agent.metrics.totalExecutions - 1) +
      agent.metrics.lastExecutionTime
    ) / agent.metrics.totalExecutions;

    if (success) {
      task.status = 'completed';
      agent.load = Math.max(0, agent.load - 5);
    } else {
      task.status = 'failed';
      agent.metrics.failedExecutions++;
      agent.metrics.successRate =
        (agent.metrics.totalExecutions - agent.metrics.failedExecutions) /
        agent.metrics.totalExecutions;

      throw new Error('Task execution failed');
    }

    this.completedExecutions.push(task);
  }

  private createExecutionError(task: ExecutionTask, error: unknown): ExecutionError {
    const message = error instanceof Error ? error.message : String(error);

    return {
      stepId: task.stepId,
      code: 'EXECUTION_FAILED',
      message,
      recoverable: task.retryCount < this.config.maxRetries
    };
  }

  private determineOutcomeStatus(
    completed: number,
    total: number,
    errors: ExecutionError[]
  ): ExecutionOutcome['status'] {
    if (completed === total && errors.length === 0) return 'success';
    if (completed === 0) return 'failure';
    if (errors.some(e => e.code === 'TIMEOUT')) return 'timeout';
    if (completed > 0 && completed < total) return 'partial';
    return 'failure';
  }

  private calculateOptimalDistribution(
    steps: ExecutionStep[],
    agents: AgentSnapshot[]
  ): Map<string, string> {
    const distribution = new Map<string, string>();

    if (agents.length === 0) return distribution;

    // Distribuir steps entre agentes baseado em carga
    const sortedAgents = [...agents].sort((a, b) => a.load - b.load);

    steps.forEach((step, index) => {
      const agent = sortedAgents[index % sortedAgents.length];
      distribution.set(step.id, agent.id);
    });

    return distribution;
  }

  private calculateAverageLoad(
    distribution: Map<string, string>,
    agents: AgentSnapshot[]
  ): number {
    const loadPerAgent = new Map<string, number>();

    for (const agentId of distribution.values()) {
      loadPerAgent.set(agentId, (loadPerAgent.get(agentId) || 0) + 1);
    }

    const totalLoad = Array.from(loadPerAgent.values()).reduce((sum, count) => sum + count, 0);
    return totalLoad / agents.length;
  }

  private calculateEffectiveParallelism(distribution: Map<string, string>): number {
    const agentCounts = new Map<string, number>();

    for (const agentId of distribution.values()) {
      agentCounts.set(agentId, (agentCounts.get(agentId) || 0) + 1);
    }

    return agentCounts.size;
  }

  private calculateBalanceScore(
    assignments: Map<string, ExecutionTask[]>,
    agents: AgentSnapshot[]
  ): number {
    if (agents.length === 0) return 0;

    const taskCounts = Array.from(assignments.values()).map(tasks => tasks.length);
    const avgTasks = taskCounts.reduce((sum, count) => sum + count, 0) / agents.length;

    if (avgTasks === 0) return 1;

    // Calcular desvio padrão
    const variance = taskCounts.reduce((sum, count) =>
      sum + Math.pow(count - avgTasks, 2), 0
    ) / agents.length;

    const stdDev = Math.sqrt(variance);

    // Score inversamente proporcional ao desvio
    return Math.max(0, 1 - (stdDev / avgTasks));
  }
}

// ========== Funções Exportadas (Compatibilidade) ==========

export function balanceLoad(agents: { id: string; load: number }[]): { id: string; load: number }[] {
  if (!agents.length) return [];

  const avgLoad = agents.reduce((acc, agent) => acc + agent.load, 0) / agents.length;
  return agents.map(agent => ({
    ...agent,
    load: Number(((agent.load + avgLoad) / 2).toFixed(2))
  }));
}

export function dispatchAgents(
  agents: { id: string; load: number }[],
  tasks: unknown[]
): { assignments: Record<string, unknown[]> } {
  if (!agents.length || !tasks.length) {
    return { assignments: {} };
  }

  const sortedAgents = [...agents].sort((a, b) => a.load - b.load);
  const assignments: Record<string, unknown[]> = {};

  let cursor = 0;
  for (const task of tasks) {
    const agent = sortedAgents[cursor % sortedAgents.length];
    assignments[agent.id] = assignments[agent.id] ?? [];
    assignments[agent.id].push(task);
    cursor += 1;
  }

  return { assignments };
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M4] Testando Distributed Execution Manager...\n');

  async function runTests() {
    const manager = new DistributedExecutionManager();
    await manager.initialize();

    // Registrar agentes de teste
    console.log('=== Teste 1: Registrar Agentes ===');
    const testAgents: Agent[] = [
      { id: 'agent-1', name: 'Agent Alpha', status: 'available', load: 20, capabilities: ['analysis', 'processing'] },
      { id: 'agent-2', name: 'Agent Beta', status: 'available', load: 40, capabilities: ['processing', 'output'] },
      { id: 'agent-3', name: 'Agent Gamma', status: 'busy', load: 60, capabilities: ['analysis'] },
      { id: 'agent-4', name: 'Agent Delta', status: 'offline', load: 0 }
    ];

    for (const agent of testAgents) {
      manager.registerAgent(agent);
    }
    console.log('Agentes registrados:', manager.getAgentSnapshots().map(a => `${a.id} (${a.load}%)`));

    // Teste de balanceamento
    console.log('\n=== Teste 2: Balanceamento de Carga ===');
    const balanced = manager.balanceLoad();
    console.log('Após balanceamento:', balanced.map(a => `${a.id}: ${a.load}%`));

    // Teste de execução de plano
    console.log('\n=== Teste 3: Executar Plano ===');
    const testPlan: OrchestrationPlan = {
      id: 'plan_test_1',
      decisionId: 'decision_1',
      steps: [
        { id: 's1', type: 'validation', target: 'validator', timeout: 2000, retries: 1, onFailure: 'abort' },
        { id: 's2', type: 'tool_call', target: 'processor', timeout: 5000, retries: 2, onFailure: 'retry' },
        { id: 's3', type: 'tool_call', target: 'analyzer', timeout: 5000, retries: 2, onFailure: 'retry' },
        { id: 's4', type: 'validation', target: 'output', timeout: 2000, retries: 1, onFailure: 'skip' }
      ],
      dependencies: [],
      agents: testAgents.filter(a => a.status !== 'offline'),
      timeoutBudget: 30000,
      rollbackPolicy: { enabled: true, strategy: 'partial', checkpoints: ['s2'] },
      priority: 'high',
      createdAt: Date.now(),
      constraints: [],
      expectedMetrics: { estimatedDuration: 14000, parallelism: 2, criticalPath: ['s1', 's2', 's4'] }
    };

    const outcome = await manager.executePlan(testPlan);
    console.log('Resultado:', outcome.status);
    console.log('Steps completados:', `${outcome.stepsCompleted}/${outcome.stepsTotal}`);
    console.log('Duração:', `${outcome.duration}ms`);
    if (outcome.errors.length > 0) {
      console.log('Erros:', outcome.errors);
    }

    // Health check
    console.log('\n=== Teste 4: Health Check ===');
    const health = await manager.healthCheck();
    console.log('Health status:', Object.fromEntries(health));

    console.log('\n[AE2:M4] Status:', manager.getStatus());
    console.log('\n[AE2:M4] ✓ Distributed Execution Manager testado com sucesso');
  }

  runTests().catch(console.error);
}
