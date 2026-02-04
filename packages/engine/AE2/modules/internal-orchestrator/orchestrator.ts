/**
 * Internal Orchestrator - Módulo M2 do AE2
 * Responsável por coordenação de módulos, criação de planos e gerenciamento de workflows
 */

import type {
  StrategicDecision,
  Agent,
  Constraint,
  OrchestrationPlan,
  ExecutionStep,
  Dependency,
  RollbackPolicy,
  PlanMetrics,
  ModuleStatus,
  DecisionPriority
} from '../../types';

// ========== Configurações ==========

interface OrchestratorConfig {
  /** Timeout padrão por step em ms */
  defaultStepTimeout: number;
  /** Número máximo de retries por step */
  maxRetries: number;
  /** Paralelismo máximo */
  maxParallelism: number;
  /** Habilitar rollback automático */
  enableAutoRollback: boolean;
  /** Timeout budget padrão em ms */
  defaultTimeoutBudget: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultStepTimeout: 5000,
  maxRetries: 3,
  maxParallelism: 5,
  enableAutoRollback: true,
  defaultTimeoutBudget: 60000
};

// ========== Tipos de Step ==========

type StepType = 'agent_call' | 'tool_call' | 'validation' | 'sync_point';
type FailurePolicy = 'abort' | 'skip' | 'retry' | 'fallback';

// ========== Classe Principal ==========

export class InternalOrchestrator {
  private config: OrchestratorConfig;
  private initialized = false;
  private lastActivity?: number;
  private plansCreated = 0;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M2] Internal Orchestrator initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M2] Internal Orchestrator initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'InternalOrchestrator',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        plansCreated: this.plansCreated
      }
    };
  }

  /**
   * Cria um plano de orquestração baseado na decisão estratégica
   */
  async createPlan(
    decision: StrategicDecision,
    agents: Agent[],
    constraints: Constraint[]
  ): Promise<OrchestrationPlan> {
    console.log('[AE2:M2] Creating orchestration plan...');
    this.lastActivity = Date.now();
    this.plansCreated++;

    // Filtrar agentes disponíveis
    const availableAgents = this.filterAvailableAgents(agents);

    // Gerar steps baseados na decisão
    const steps = this.generateExecutionSteps(decision, availableAgents);

    // Calcular dependências
    const dependencies = this.calculateDependencies(steps);

    // Definir política de rollback
    const rollbackPolicy = this.determineRollbackPolicy(decision, constraints);

    // Calcular timeout budget
    const timeoutBudget = this.calculateTimeoutBudget(decision, steps, constraints);

    // Calcular métricas do plano
    const expectedMetrics = this.calculatePlanMetrics(steps, dependencies);

    const plan: OrchestrationPlan = {
      id: this.generatePlanId(),
      decisionId: decision.id,
      steps,
      dependencies,
      agents: availableAgents,
      timeoutBudget,
      rollbackPolicy,
      priority: decision.priority,
      createdAt: Date.now(),
      constraints: this.processConstraints(constraints),
      expectedMetrics
    };

    console.log(`[AE2:M2] Plan created: ${plan.id} (${steps.length} steps, ${availableAgents.length} agents)`);
    return plan;
  }

  /**
   * Otimiza um plano existente
   */
  async optimizePlan(plan: OrchestrationPlan): Promise<OrchestrationPlan> {
    console.log(`[AE2:M2] Optimizing plan ${plan.id}...`);
    this.lastActivity = Date.now();

    // Identificar steps paralelos
    const parallelGroups = this.identifyParallelGroups(plan.steps, plan.dependencies);

    // Reordenar steps para máximo paralelismo
    const optimizedSteps = this.reorderForParallelism(plan.steps, parallelGroups);

    // Recalcular métricas
    const optimizedMetrics = this.calculatePlanMetrics(optimizedSteps, plan.dependencies);

    // Ajustar timeouts baseado na otimização
    const adjustedSteps = this.adjustTimeouts(optimizedSteps, plan.timeoutBudget);

    console.log(`[AE2:M2] Plan optimized: parallelism ${plan.expectedMetrics.parallelism} -> ${optimizedMetrics.parallelism}`);

    return {
      ...plan,
      steps: adjustedSteps,
      expectedMetrics: optimizedMetrics
    };
  }

  /**
   * Valida um plano antes da execução
   */
  validatePlan(plan: OrchestrationPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verificar se há steps
    if (plan.steps.length === 0) {
      errors.push('Plan has no execution steps');
    }

    // Verificar dependências circulares
    if (this.hasCircularDependencies(plan.dependencies)) {
      errors.push('Plan has circular dependencies');
    }

    // Verificar se todos os targets existem
    const agentIds = new Set(plan.agents.map(a => a.id));
    for (const step of plan.steps) {
      if (step.type === 'agent_call' && !agentIds.has(step.target)) {
        errors.push(`Step ${step.id} references unknown agent: ${step.target}`);
      }
    }

    // Verificar timeout budget
    const totalTimeout = plan.steps.reduce((sum, s) => sum + s.timeout, 0);
    if (totalTimeout > plan.timeoutBudget * 2) {
      errors.push(`Total step timeout (${totalTimeout}ms) exceeds budget (${plan.timeoutBudget}ms)`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ========== Métodos Privados ==========

  private filterAvailableAgents(agents: Agent[]): Agent[] {
    return agents.filter(agent => {
      // Filtrar por status
      if (agent.status === 'offline') return false;

      // Filtrar por carga
      if ((agent.load ?? 0) > 90) return false;

      return true;
    });
  }

  private generateExecutionSteps(
    decision: StrategicDecision,
    agents: Agent[]
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    let stepCounter = 0;

    // Step 1: Validação inicial
    steps.push({
      id: `step_${++stepCounter}`,
      type: 'validation',
      target: 'input_validator',
      timeout: this.config.defaultStepTimeout,
      retries: 1,
      onFailure: 'abort'
    });

    // Steps para cada passo do plano da decisão
    for (const planStep of decision.planSteps) {
      const stepType = this.determineStepType(planStep);
      const failurePolicy = this.determineFailurePolicy(planStep, decision.priority);

      steps.push({
        id: `step_${++stepCounter}`,
        type: stepType,
        target: planStep.tool || planStep.agent || 'default',
        params: {
          action: planStep.action,
          originalStepId: planStep.id
        },
        timeout: planStep.timeout || this.config.defaultStepTimeout,
        retries: planStep.retryable ? this.config.maxRetries : 0,
        onFailure: failurePolicy,
        fallbackStep: planStep.optional ? undefined : `fallback_${stepCounter}`
      });
    }

    // Step de sincronização (se houver steps paralelos)
    if (steps.length > 3) {
      steps.push({
        id: `step_${++stepCounter}`,
        type: 'sync_point',
        target: 'synchronizer',
        timeout: this.config.defaultStepTimeout / 2,
        retries: 0,
        onFailure: 'skip'
      });
    }

    // Step final: Validação de output
    steps.push({
      id: `step_${++stepCounter}`,
      type: 'validation',
      target: 'output_validator',
      timeout: this.config.defaultStepTimeout,
      retries: 1,
      onFailure: 'skip'
    });

    return steps;
  }

  private determineStepType(planStep: { tool?: string; agent?: string }): StepType {
    if (planStep.tool) return 'tool_call';
    if (planStep.agent) return 'agent_call';
    return 'validation';
  }

  private determineFailurePolicy(
    planStep: { optional: boolean; retryable: boolean },
    priority: DecisionPriority
  ): FailurePolicy {
    // Steps opcionais podem ser pulados
    if (planStep.optional) return 'skip';

    // Alta prioridade: tentar retry antes de abortar
    if (priority === 'critical' || priority === 'high') {
      return planStep.retryable ? 'retry' : 'fallback';
    }

    // Prioridade normal: retry se possível
    if (planStep.retryable) return 'retry';

    return 'abort';
  }

  private calculateDependencies(steps: ExecutionStep[]): Dependency[] {
    const dependencies: Dependency[] = [];

    for (let i = 1; i < steps.length; i++) {
      const currentStep = steps[i];
      const previousStep = steps[i - 1];

      // Validações sempre são sequenciais
      if (currentStep.type === 'validation' || previousStep.type === 'validation') {
        dependencies.push({
          from: previousStep.id,
          to: currentStep.id,
          type: 'sequential'
        });
        continue;
      }

      // Sync points dependem de todos os anteriores
      if (currentStep.type === 'sync_point') {
        for (let j = 0; j < i; j++) {
          if (steps[j].type !== 'validation') {
            dependencies.push({
              from: steps[j].id,
              to: currentStep.id,
              type: 'sequential'
            });
          }
        }
        continue;
      }

      // Tool calls podem ter dependência de dados
      if (currentStep.type === 'tool_call' && previousStep.type === 'tool_call') {
        dependencies.push({
          from: previousStep.id,
          to: currentStep.id,
          type: 'data'
        });
      }
    }

    return dependencies;
  }

  private determineRollbackPolicy(
    decision: StrategicDecision,
    constraints: Constraint[]
  ): RollbackPolicy {
    // Verificar se há constraint de rollback
    const rollbackConstraint = constraints.find(c => c.type === 'technical' && c.id.includes('rollback'));

    if (rollbackConstraint && !rollbackConstraint.mandatory) {
      return {
        enabled: false,
        strategy: 'none',
        checkpoints: []
      };
    }

    // Para decisões críticas, rollback total
    if (decision.priority === 'critical') {
      return {
        enabled: true,
        strategy: 'full',
        checkpoints: decision.planSteps
          .filter(s => !s.optional)
          .map(s => s.id)
      };
    }

    // Para outras, rollback parcial
    return {
      enabled: this.config.enableAutoRollback,
      strategy: 'partial',
      checkpoints: decision.planSteps
        .filter(s => !s.optional && s.action.includes('main'))
        .map(s => s.id)
    };
  }

  private calculateTimeoutBudget(
    decision: StrategicDecision,
    steps: ExecutionStep[],
    constraints: Constraint[]
  ): number {
    // Verificar constraint de tempo
    const timeConstraint = constraints.find(c => c.type === 'time' && c.mandatory);
    if (timeConstraint && typeof timeConstraint.value === 'number') {
      return timeConstraint.value as number;
    }

    // Calcular baseado nos steps
    const stepsTotal = steps.reduce((sum, s) => sum + s.timeout, 0);

    // Adicionar buffer baseado na prioridade
    const bufferMultiplier = decision.priority === 'critical' ? 1.5 :
                              decision.priority === 'high' ? 1.3 :
                              decision.priority === 'normal' ? 1.2 : 1.1;

    const calculated = Math.round(stepsTotal * bufferMultiplier);

    // Respeitar timeout da decisão se definido
    if (decision.timeoutMs && decision.timeoutMs < calculated) {
      return decision.timeoutMs;
    }

    return Math.min(calculated, this.config.defaultTimeoutBudget);
  }

  private calculatePlanMetrics(steps: ExecutionStep[], dependencies: Dependency[]): PlanMetrics {
    // Identificar grupos paralelos
    const parallelGroups = this.identifyParallelGroups(steps, dependencies);

    // Calcular caminho crítico
    const criticalPath = this.findCriticalPath(steps, dependencies);

    // Calcular duração estimada (caminho crítico)
    const estimatedDuration = criticalPath.reduce((sum, stepId) => {
      const step = steps.find(s => s.id === stepId);
      return sum + (step?.timeout ?? 0);
    }, 0);

    return {
      estimatedDuration,
      parallelism: parallelGroups.length > 0 ? Math.max(...parallelGroups.map(g => g.length)) : 1,
      criticalPath
    };
  }

  private identifyParallelGroups(steps: ExecutionStep[], dependencies: Dependency[]): string[][] {
    const groups: string[][] = [];
    const dependencyMap = new Map<string, Set<string>>();

    // Construir mapa de dependências
    for (const dep of dependencies) {
      if (!dependencyMap.has(dep.to)) {
        dependencyMap.set(dep.to, new Set());
      }
      dependencyMap.get(dep.to)!.add(dep.from);
    }

    // Agrupar steps sem dependências mútuas
    const processed = new Set<string>();

    for (const step of steps) {
      if (processed.has(step.id)) continue;

      const group: string[] = [step.id];
      processed.add(step.id);

      // Encontrar outros steps que podem rodar em paralelo
      for (const other of steps) {
        if (processed.has(other.id)) continue;

        const stepDeps = dependencyMap.get(step.id) || new Set();
        const otherDeps = dependencyMap.get(other.id) || new Set();

        // Podem rodar em paralelo se não dependem um do outro
        if (!stepDeps.has(other.id) && !otherDeps.has(step.id)) {
          group.push(other.id);
          processed.add(other.id);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  private findCriticalPath(steps: ExecutionStep[], dependencies: Dependency[]): string[] {
    if (steps.length === 0) return [];

    // Construir grafo
    const graph = new Map<string, { next: string[]; timeout: number }>();
    for (const step of steps) {
      graph.set(step.id, { next: [], timeout: step.timeout });
    }

    for (const dep of dependencies) {
      const node = graph.get(dep.from);
      if (node) {
        node.next.push(dep.to);
      }
    }

    // Encontrar caminho mais longo (caminho crítico)
    const visited = new Set<string>();
    let longestPath: string[] = [];
    let longestDuration = 0;

    const dfs = (stepId: string, path: string[], duration: number) => {
      path.push(stepId);
      const node = graph.get(stepId);

      if (!node || node.next.length === 0) {
        if (duration > longestDuration) {
          longestDuration = duration;
          longestPath = [...path];
        }
      } else {
        for (const next of node.next) {
          if (!visited.has(next)) {
            visited.add(next);
            const nextNode = graph.get(next);
            dfs(next, path, duration + (nextNode?.timeout ?? 0));
            visited.delete(next);
          }
        }
      }

      path.pop();
    };

    // Iniciar de steps sem dependências
    const startSteps = steps.filter(s =>
      !dependencies.some(d => d.to === s.id)
    );

    for (const start of startSteps) {
      visited.add(start.id);
      const node = graph.get(start.id);
      dfs(start.id, [], node?.timeout ?? 0);
      visited.delete(start.id);
    }

    return longestPath.length > 0 ? longestPath : [steps[0].id];
  }

  private reorderForParallelism(steps: ExecutionStep[], parallelGroups: string[][]): ExecutionStep[] {
    // Por enquanto, mantém a ordem original
    // TODO: Implementar reordenação inteligente
    return steps;
  }

  private adjustTimeouts(steps: ExecutionStep[], totalBudget: number): ExecutionStep[] {
    const totalTimeout = steps.reduce((sum, s) => sum + s.timeout, 0);

    if (totalTimeout <= totalBudget) {
      return steps;
    }

    // Reduzir proporcionalmente
    const ratio = totalBudget / totalTimeout;

    return steps.map(step => ({
      ...step,
      timeout: Math.max(1000, Math.round(step.timeout * ratio))
    }));
  }

  private hasCircularDependencies(dependencies: Dependency[]): boolean {
    const graph = new Map<string, string[]>();

    for (const dep of dependencies) {
      if (!graph.has(dep.from)) {
        graph.set(dep.from, []);
      }
      graph.get(dep.from)!.push(dep.to);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return true;
      }
    }

    return false;
  }

  private processConstraints(constraints: Constraint[]): Constraint[] {
    // Ordenar por prioridade e obrigatoriedade
    return [...constraints].sort((a, b) => {
      if (a.mandatory !== b.mandatory) {
        return a.mandatory ? -1 : 1;
      }
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M2] Testando Internal Orchestrator...\n');

  async function runTests() {
    const orchestrator = new InternalOrchestrator();
    await orchestrator.initialize();

    // Criar decisão de teste
    const testDecision: StrategicDecision = {
      id: 'decision_test_1',
      priority: 'high',
      approach: 'balanced',
      confidence: 'medium',
      confidenceScore: 0.75,
      selectedAgents: ['assistant', 'researcher'],
      recommendedTools: ['ChainOfThoughtGenerator', 'InsightSummarizer'],
      planSteps: [
        { id: 'ps1', action: 'validate_input', tool: 'UserIntentParser', dependencies: [], timeout: 3000, retryable: true, optional: false },
        { id: 'ps2', action: 'process_main', tool: 'ChainOfThoughtGenerator', dependencies: ['ps1'], timeout: 10000, retryable: true, optional: false },
        { id: 'ps3', action: 'generate_output', tool: 'InsightSummarizer', dependencies: ['ps2'], timeout: 5000, retryable: false, optional: false }
      ],
      strategicAnalysis: {
        goalAlignment: 0.8,
        feasibility: 0.7,
        resourceCost: 0.5,
        expectedDuration: 20000,
        objectives: ['Analisar dados'],
        constraints: []
      },
      risks: [],
      timeoutMs: 30000,
      createdAt: Date.now(),
      reasoning: 'Teste de orquestração'
    };

    const testAgents: Agent[] = [
      { id: 'assistant', name: 'Assistant', status: 'available', load: 30 },
      { id: 'researcher', name: 'Researcher', status: 'available', load: 50 },
      { id: 'offline_agent', name: 'Offline', status: 'offline' }
    ];

    const testConstraints: Constraint[] = [
      { id: 'c1', type: 'time', mandatory: true, value: 60000 },
      { id: 'c2', type: 'security', mandatory: false }
    ];

    // Teste 1: Criar plano
    console.log('=== Teste 1: Criar Plano ===');
    const plan = await orchestrator.createPlan(testDecision, testAgents, testConstraints);
    console.log('Plan ID:', plan.id);
    console.log('Steps:', plan.steps.length);
    console.log('Agentes:', plan.agents.map(a => a.id));
    console.log('Timeout Budget:', plan.timeoutBudget);
    console.log('Métricas:', plan.expectedMetrics);

    // Teste 2: Validar plano
    console.log('\n=== Teste 2: Validar Plano ===');
    const validation = orchestrator.validatePlan(plan);
    console.log('Válido:', validation.valid);
    if (validation.errors.length > 0) {
      console.log('Erros:', validation.errors);
    }

    // Teste 3: Otimizar plano
    console.log('\n=== Teste 3: Otimizar Plano ===');
    const optimizedPlan = await orchestrator.optimizePlan(plan);
    console.log('Métricas originais:', plan.expectedMetrics);
    console.log('Métricas otimizadas:', optimizedPlan.expectedMetrics);

    console.log('\n[AE2:M2] Status:', orchestrator.getStatus());
    console.log('\n[AE2:M2] ✓ Internal Orchestrator testado com sucesso');
  }

  runTests().catch(console.error);
}
