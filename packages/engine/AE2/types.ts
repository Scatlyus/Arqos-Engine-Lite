/**
 * Tipos para AE2 Strategos
 * Define interfaces e tipos para orquestração estratégica
 */

// ========== Módulos ==========

export interface Module {
  initialize(): Promise<void>;
  getStatus(): ModuleStatus;
}

export interface ModuleStatus {
  name: string;
  initialized: boolean;
  healthy: boolean;
  lastActivity?: number;
  stats?: Record<string, any>;
}

// ========== Contexto de Decisão ==========

export interface DecisionContext {
  /** ID único do contexto */
  id?: string;
  /** Intenção do usuário */
  intent?: string;
  /** Domínio da requisição */
  domain?: string;
  /** Urgência (0-100, maior = mais urgente) */
  urgency?: number;
  /** Complexidade estimada (0-100) */
  complexity?: number;
  /** Restrições aplicáveis */
  constraints?: Constraint[];
  /** Metadados adicionais */
  metadata?: Record<string, unknown>;
  /** Histórico de contexto (últimas interações) */
  history?: ContextHistoryItem[];
  /** Timestamp de criação */
  timestamp?: number;
}

export interface ContextHistoryItem {
  intent: string;
  outcome: 'success' | 'partial' | 'failure';
  timestamp: number;
}

// ========== Decisões Estratégicas ==========

export type DecisionPriority = 'critical' | 'high' | 'normal' | 'low';
export type DecisionApproach = 'aggressive' | 'balanced' | 'conservative' | 'exploratory';
export type DecisionConfidence = 'high' | 'medium' | 'low';

export interface StrategicDecision {
  /** ID único da decisão */
  id: string;
  /** Prioridade da decisão */
  priority: DecisionPriority;
  /** Abordagem recomendada */
  approach: DecisionApproach;
  /** Nível de confiança */
  confidence: DecisionConfidence;
  /** Score de confiança (0-1) */
  confidenceScore: number;
  /** Agentes selecionados */
  selectedAgents: string[];
  /** Ferramentas recomendadas */
  recommendedTools: string[];
  /** Passos do plano */
  planSteps: PlanStep[];
  /** Análise estratégica */
  strategicAnalysis: StrategicAnalysis;
  /** Riscos identificados */
  risks: Risk[];
  /** Timeout recomendado em ms */
  timeoutMs: number;
  /** Timestamp de criação */
  createdAt: number;
  /** Raciocínio da decisão */
  reasoning: string;
}

export interface StrategicAnalysis {
  goalAlignment: number;
  feasibility: number;
  resourceCost: number;
  expectedDuration: number;
  objectives: string[];
  constraints: Constraint[];
}

export interface PlanStep {
  id: string;
  action: string;
  agent?: string;
  tool?: string;
  dependencies: string[];
  timeout: number;
  retryable: boolean;
  optional: boolean;
}

export interface Risk {
  id: string;
  type: 'technical' | 'resource' | 'timeout' | 'dependency' | 'unknown';
  severity: 'high' | 'medium' | 'low';
  description: string;
  mitigation?: string;
}

// ========== Orquestração ==========

export interface OrchestrationRequest {
  /** Contexto da requisição */
  context: DecisionContext;
  /** Agentes disponíveis */
  agents: Agent[];
  /** Restrições globais */
  constraints: Constraint[];
  /** Timeout máximo em ms */
  maxTimeout?: number;
  /** ID de trace para rastreamento */
  traceId?: string;
}

export interface OrchestrationPlan {
  /** ID único do plano */
  id: string;
  /** ID da decisão que originou o plano */
  decisionId: string;
  /** Passos de execução */
  steps: ExecutionStep[];
  /** Dependências entre passos */
  dependencies: Dependency[];
  /** Agentes envolvidos */
  agents: Agent[];
  /** Budget de timeout em ms */
  timeoutBudget: number;
  /** Política de rollback */
  rollbackPolicy: RollbackPolicy;
  /** Prioridade do plano */
  priority: DecisionPriority;
  /** Timestamp de criação */
  createdAt: number;
  /** Restrições aplicadas */
  constraints: Constraint[];
  /** Métricas esperadas */
  expectedMetrics: PlanMetrics;
}

export interface ExecutionStep {
  id: string;
  type: 'agent_call' | 'tool_call' | 'validation' | 'sync_point';
  target: string;
  params?: Record<string, unknown>;
  timeout: number;
  retries: number;
  onFailure: 'abort' | 'skip' | 'retry' | 'fallback';
  fallbackStep?: string;
}

export interface Dependency {
  from: string;
  to: string;
  type: 'sequential' | 'data' | 'resource';
}

export interface RollbackPolicy {
  enabled: boolean;
  strategy: 'full' | 'partial' | 'none';
  checkpoints: string[];
}

export interface PlanMetrics {
  estimatedDuration: number;
  parallelism: number;
  criticalPath: string[];
}

// ========== Agentes e Ferramentas ==========

export interface Agent {
  /** ID único do agente */
  id: string;
  /** Nome do agente */
  name?: string;
  /** Tipo do agente */
  type?: string;
  /** Capacidades do agente */
  capabilities?: string[];
  /** Status atual */
  status?: 'available' | 'busy' | 'offline';
  /** Carga atual (0-100) */
  load?: number;
  /** Métricas de performance */
  metrics?: AgentMetrics;
}

export interface AgentMetrics {
  avgResponseTime: number;
  successRate: number;
  totalExecutions: number;
}

export interface Tool {
  id: string;
  name: string;
  phase: 'recebe' | 'colhe' | 'processa' | 'fornece';
  timeout: number;
}

// ========== Restrições ==========

export interface Constraint {
  /** ID da restrição */
  id: string;
  /** Tipo da restrição */
  type?: 'time' | 'resource' | 'security' | 'business' | 'technical';
  /** Descrição */
  description?: string;
  /** Se é obrigatória */
  mandatory?: boolean;
  /** Valor da restrição */
  value?: unknown;
  /** Prioridade (para resolução de conflitos) */
  priority?: number;
}

// ========== Reflexão e Aprendizado ==========

export interface ReflectionReport {
  /** ID do relatório */
  id: string;
  /** Resumo da reflexão */
  summary: string;
  /** Período analisado */
  period: {
    start: number;
    end: number;
  };
  /** Métricas do período */
  metrics: ReflectionMetrics;
  /** Insights identificados */
  insights: Insight[];
  /** Recomendações */
  recommendations: Recommendation[];
  /** Timestamp */
  createdAt: number;
}

export interface ReflectionMetrics {
  totalDecisions: number;
  successRate: number;
  avgConfidence: number;
  avgExecutionTime: number;
  topAgents: string[];
  topTools: string[];
}

export interface Insight {
  type: 'pattern' | 'anomaly' | 'trend' | 'correlation';
  description: string;
  confidence: number;
  evidence: string[];
}

export interface Recommendation {
  type: 'optimization' | 'warning' | 'improvement';
  description: string;
  priority: DecisionPriority;
  actionable: boolean;
}

// ========== Resultados de Execução ==========

export interface ExecutionOutcome {
  /** ID do resultado */
  id: string;
  /** ID do plano executado */
  planId: string;
  /** ID da decisão */
  decisionId: string;
  /** Status final */
  status: 'success' | 'partial' | 'failure' | 'timeout' | 'cancelled';
  /** Duração total em ms */
  duration: number;
  /** Passos executados */
  stepsCompleted: number;
  /** Total de passos */
  stepsTotal: number;
  /** Erros ocorridos */
  errors: ExecutionError[];
  /** Resultado final */
  result?: unknown;
  /** Timestamp de início */
  startedAt: number;
  /** Timestamp de término */
  completedAt: number;
}

export interface ExecutionError {
  stepId: string;
  code: string;
  message: string;
  recoverable: boolean;
}

// ========== Inputs para Decision Engine ==========

export interface DecisionInputs {
  /** Análise estratégica do Strategic Core */
  strategic: StrategicAnalysis;
  /** Contexto ambiental (fullstack) */
  environmental?: EnvironmentalContext;
  /** Contexto cognitivo do AE1 (fullstack) */
  cognitive?: CognitiveContext;
  /** Simulação de cenários (fullstack) */
  simulation?: SimulationResult;
}

export interface EnvironmentalContext {
  systemLoad: number;
  availableAgents: number;
  activeProcesses: number;
  resourceUtilization: number;
}

export interface CognitiveContext {
  recentPatterns: string[];
  userPreferences: Record<string, unknown>;
  learningInsights: string[];
}

export interface SimulationResult {
  scenarios: ScenarioOutcome[];
  recommended: string;
  confidence: number;
}

export interface ScenarioOutcome {
  id: string;
  name: string;
  probability: number;
  expectedDuration: number;
  riskLevel: 'high' | 'medium' | 'low';
}

// ========== Auditoria ==========

export interface AuditEntry {
  id: string;
  type: 'decision' | 'execution' | 'reflection' | 'error';
  timestamp: number;
  actorModule: string;
  action: string;
  details: Record<string, unknown>;
  traceId?: string;
}

export interface DecisionAuditEntry extends AuditEntry {
  type: 'decision';
  decision: StrategicDecision;
  context: DecisionContext;
  duration: number;
}
