/**
 * Decision Auditor - Módulo M3 do AE2
 * Responsável por auditoria, logging de decisões e tracking de compliance
 */

import type {
  StrategicDecision,
  DecisionContext,
  ExecutionOutcome,
  AuditEntry,
  DecisionAuditEntry,
  ModuleStatus
} from '../../types';

// ========== Configurações ==========

interface AuditorConfig {
  /** Máximo de entradas em memória */
  maxInMemory: number;
  /** Persistir em arquivo */
  persistToFile: boolean;
  /** Caminho do arquivo de log */
  logFilePath?: string;
  /** Habilitar compliance checks */
  enableCompliance: boolean;
  /** Nível de detalhe do log */
  logLevel: 'minimal' | 'standard' | 'detailed';
}

const DEFAULT_CONFIG: AuditorConfig = {
  maxInMemory: 1000,
  persistToFile: false,
  enableCompliance: true,
  logLevel: 'standard'
};

// ========== Tipos de Compliance ==========

interface ComplianceRule {
  id: string;
  name: string;
  check: (decision: StrategicDecision, context?: DecisionContext) => boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
  decisionId: string;
}

interface AuditStats {
  totalDecisions: number;
  totalExecutions: number;
  successRate: number;
  avgDecisionTime: number;
  complianceViolations: number;
  criticalDecisions: number;
  recentErrors: number;
}

// ========== Classe Principal ==========

export class DecisionAuditor {
  private config: AuditorConfig;
  private initialized = false;
  private lastActivity?: number;

  // Storage em memória
  private auditLog: AuditEntry[] = [];
  private complianceViolations: ComplianceViolation[] = [];
  private decisionHistory: Map<string, DecisionAuditEntry> = new Map();
  private executionOutcomes: Map<string, ExecutionOutcome> = new Map();

  // Regras de compliance
  private complianceRules: ComplianceRule[] = [];

  // Estatísticas
  private stats: AuditStats = {
    totalDecisions: 0,
    totalExecutions: 0,
    successRate: 0,
    avgDecisionTime: 0,
    complianceViolations: 0,
    criticalDecisions: 0,
    recentErrors: 0
  };

  constructor(config: Partial<AuditorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultComplianceRules();
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M3] Decision Auditor initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M3] Decision Auditor initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'DecisionAuditor',
      initialized: this.initialized,
      healthy: this.initialized && this.complianceViolations.length < 100,
      lastActivity: this.lastActivity,
      stats: {
        totalDecisions: this.stats.totalDecisions,
        totalExecutions: this.stats.totalExecutions,
        complianceViolations: this.stats.complianceViolations,
        auditLogSize: this.auditLog.length
      }
    };
  }

  /**
   * Loga uma decisão estratégica
   */
  async logDecision(
    decision: StrategicDecision,
    context: DecisionContext,
    duration: number
  ): Promise<void> {
    console.log(`[AE2:M3] Logging decision ${decision.id}...`);
    this.lastActivity = Date.now();
    this.stats.totalDecisions++;

    if (decision.priority === 'critical') {
      this.stats.criticalDecisions++;
    }

    // Criar audit entry
    const auditEntry: DecisionAuditEntry = {
      id: `audit_decision_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'decision',
      timestamp: Date.now(),
      actorModule: 'DecisionEngine',
      action: 'make_decision',
      decision,
      context,
      duration,
      details: {
        priority: decision.priority,
        approach: decision.approach,
        confidence: decision.confidence,
        confidenceScore: decision.confidenceScore,
        selectedAgents: decision.selectedAgents,
        recommendedTools: decision.recommendedTools,
        risksCount: decision.risks.length
      }
    };

    // Adicionar ao log
    this.auditLog.push(auditEntry);
    this.decisionHistory.set(decision.id, auditEntry);

    // Limpar se ultrapassar limite
    if (this.auditLog.length > this.config.maxInMemory) {
      this.auditLog.shift();
    }

    // Verificar compliance
    if (this.config.enableCompliance) {
      await this.checkCompliance(decision, context);
    }

    // Atualizar estatísticas
    this.updateDecisionStats(duration);
  }

  /**
   * Loga um resultado de execução
   */
  async logExecution(outcome: ExecutionOutcome): Promise<void> {
    console.log(`[AE2:M3] Logging execution ${outcome.id}...`);
    this.lastActivity = Date.now();
    this.stats.totalExecutions++;

    // Criar audit entry
    const auditEntry: AuditEntry = {
      id: `audit_execution_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'execution',
      timestamp: Date.now(),
      actorModule: 'Executor',
      action: 'execute_plan',
      details: {
        planId: outcome.planId,
        decisionId: outcome.decisionId,
        status: outcome.status,
        duration: outcome.duration,
        stepsCompleted: outcome.stepsCompleted,
        stepsTotal: outcome.stepsTotal,
        errorsCount: outcome.errors.length
      }
    };

    this.auditLog.push(auditEntry);
    this.executionOutcomes.set(outcome.id, outcome);

    // Limpar se ultrapassar limite
    if (this.auditLog.length > this.config.maxInMemory) {
      this.auditLog.shift();
    }

    // Atualizar estatísticas
    this.updateExecutionStats(outcome);

    // Verificar erros recentes
    if (outcome.status === 'failure' || outcome.status === 'timeout') {
      this.stats.recentErrors++;
    }
  }

  /**
   * Loga um erro
   */
  async logError(error: Error, context: Record<string, unknown>): Promise<void> {
    console.log('[AE2:M3] Logging error...');
    this.lastActivity = Date.now();

    const auditEntry: AuditEntry = {
      id: `audit_error_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'error',
      timestamp: Date.now(),
      actorModule: context.module as string || 'Unknown',
      action: 'error',
      details: {
        errorMessage: error.message,
        errorStack: error.stack,
        context
      }
    };

    this.auditLog.push(auditEntry);
    this.stats.recentErrors++;

    if (this.auditLog.length > this.config.maxInMemory) {
      this.auditLog.shift();
    }
  }

  /**
   * Verifica compliance de uma decisão
   */
  async checkCompliance(
    decision: StrategicDecision,
    context?: DecisionContext
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    for (const rule of this.complianceRules) {
      if (!rule.check(decision, context)) {
        const violation: ComplianceViolation = {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: rule.message,
          timestamp: Date.now(),
          decisionId: decision.id
        };

        violations.push(violation);
        this.complianceViolations.push(violation);
        this.stats.complianceViolations++;

        console.warn(`[AE2:M3] Compliance violation: ${rule.name} (${rule.severity})`);
      }
    }

    return violations;
  }

  /**
   * Retorna decisões recentes
   */
  async getRecentDecisions(limit: number = 10): Promise<StrategicDecision[]> {
    const recentEntries = [...this.decisionHistory.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return recentEntries.map(entry => entry.decision);
  }

  /**
   * Retorna execuções recentes
   */
  async getRecentExecutions(limit: number = 10): Promise<ExecutionOutcome[]> {
    return [...this.executionOutcomes.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  /**
   * Retorna violações de compliance
   */
  getComplianceViolations(severity?: 'error' | 'warning' | 'info'): ComplianceViolation[] {
    if (severity) {
      return this.complianceViolations.filter(v => v.severity === severity);
    }
    return [...this.complianceViolations];
  }

  /**
   * Retorna estatísticas gerais
   */
  getStats(): AuditStats {
    return { ...this.stats };
  }

  /**
   * Retorna audit log completo
   */
  getAuditLog(filter?: { type?: AuditEntry['type']; limit?: number }): AuditEntry[] {
    let filtered = [...this.auditLog];

    if (filter?.type) {
      filtered = filtered.filter(entry => entry.type === filter.type);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Busca decisão por ID
   */
  getDecisionById(decisionId: string): DecisionAuditEntry | undefined {
    return this.decisionHistory.get(decisionId);
  }

  /**
   * Exporta audit log
   */
  exportAuditLog(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      stats: this.stats,
      auditLog: this.auditLog,
      complianceViolations: this.complianceViolations
    }, null, 2);
  }

  /**
   * Limpa logs antigos
   */
  clearOldLogs(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const initialLength = this.auditLog.length;

    this.auditLog = this.auditLog.filter(entry => entry.timestamp >= cutoff);
    this.complianceViolations = this.complianceViolations.filter(v => v.timestamp >= cutoff);

    return initialLength - this.auditLog.length;
  }

  // ========== Métodos Privados ==========

  private registerDefaultComplianceRules(): void {
    // Regra 1: Decisões críticas devem ter alta confiança
    this.complianceRules.push({
      id: 'critical_confidence',
      name: 'Critical decisions require high confidence',
      check: (decision) => {
        if (decision.priority === 'critical') {
          return decision.confidenceScore >= 0.7;
        }
        return true;
      },
      severity: 'error',
      message: 'Critical decision has low confidence score'
    });

    // Regra 2: Decisões devem ter pelo menos um agente
    this.complianceRules.push({
      id: 'agent_required',
      name: 'Decisions must have at least one agent',
      check: (decision) => decision.selectedAgents.length > 0,
      severity: 'warning',
      message: 'Decision has no selected agents'
    });

    // Regra 3: Riscos high severity devem ter mitigação
    this.complianceRules.push({
      id: 'risk_mitigation',
      name: 'High severity risks require mitigation',
      check: (decision) => {
        const highRisks = decision.risks.filter(r => r.severity === 'high');
        return highRisks.every(r => !!r.mitigation);
      },
      severity: 'warning',
      message: 'High severity risk without mitigation plan'
    });

    // Regra 4: Timeout deve ser razoável
    this.complianceRules.push({
      id: 'reasonable_timeout',
      name: 'Timeout must be reasonable',
      check: (decision) => {
        return decision.timeoutMs >= 1000 && decision.timeoutMs <= 300000;
      },
      severity: 'info',
      message: 'Timeout is outside reasonable range (1s-5min)'
    });

    // Regra 5: Plan steps devem existir
    this.complianceRules.push({
      id: 'plan_steps_required',
      name: 'Decision must have plan steps',
      check: (decision) => decision.planSteps.length > 0,
      severity: 'error',
      message: 'Decision has no plan steps'
    });
  }

  private updateDecisionStats(duration: number): void {
    // Calcular média de tempo de decisão
    const total = this.stats.totalDecisions;
    const currentAvg = this.stats.avgDecisionTime;
    this.stats.avgDecisionTime = ((currentAvg * (total - 1)) + duration) / total;
  }

  private updateExecutionStats(outcome: ExecutionOutcome): void {
    // Calcular taxa de sucesso
    const successes = [...this.executionOutcomes.values()]
      .filter(o => o.status === 'success').length;

    this.stats.successRate = this.stats.totalExecutions > 0
      ? successes / this.stats.totalExecutions
      : 0;
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M3] Testando Decision Auditor...\n');

  async function runTests() {
    const auditor = new DecisionAuditor();
    await auditor.initialize();

    // Teste 1: Log de decisão
    console.log('=== Teste 1: Log de Decisão ===');
    const testDecision: StrategicDecision = {
      id: 'decision_test_1',
      priority: 'critical',
      approach: 'balanced',
      confidence: 'high',
      confidenceScore: 0.85,
      selectedAgents: ['assistant'],
      recommendedTools: ['ChainOfThoughtGenerator'],
      planSteps: [
        { id: 'ps1', action: 'validate', dependencies: [], timeout: 5000, retryable: true, optional: false }
      ],
      strategicAnalysis: {
        goalAlignment: 0.9,
        feasibility: 0.8,
        resourceCost: 0.4,
        expectedDuration: 10000,
        objectives: ['Test'],
        constraints: []
      },
      risks: [
        { id: 'r1', type: 'timeout', severity: 'medium', description: 'Possível timeout', mitigation: 'Aumentar timeout' }
      ],
      timeoutMs: 30000,
      createdAt: Date.now(),
      reasoning: 'Teste de auditoria'
    };

    const testContext: DecisionContext = {
      intent: 'Testar auditoria',
      urgency: 80,
      complexity: 50
    };

    await auditor.logDecision(testDecision, testContext, 150);
    console.log('Decisão logada com sucesso');
    console.log('Stats:', auditor.getStats());

    // Teste 2: Log de execução
    console.log('\n=== Teste 2: Log de Execução ===');
    const testExecution: ExecutionOutcome = {
      id: 'exec_1',
      planId: 'plan_1',
      decisionId: 'decision_test_1',
      status: 'success',
      duration: 8500,
      stepsCompleted: 3,
      stepsTotal: 3,
      errors: [],
      startedAt: Date.now() - 8500,
      completedAt: Date.now()
    };

    await auditor.logExecution(testExecution);
    console.log('Execução logada com sucesso');
    console.log('Stats:', auditor.getStats());

    // Teste 3: Compliance violation
    console.log('\n=== Teste 3: Teste de Compliance ===');
    const badDecision: StrategicDecision = {
      id: 'decision_bad',
      priority: 'critical',
      approach: 'balanced',
      confidence: 'low',
      confidenceScore: 0.3, // Baixa confiança para decisão crítica
      selectedAgents: [], // Sem agentes
      recommendedTools: [],
      planSteps: [], // Sem steps
      strategicAnalysis: {
        goalAlignment: 0.5,
        feasibility: 0.6,
        resourceCost: 0.7,
        expectedDuration: 10000,
        objectives: [],
        constraints: []
      },
      risks: [],
      timeoutMs: 100, // Timeout muito curto
      createdAt: Date.now(),
      reasoning: 'Teste de violação'
    };

    await auditor.logDecision(badDecision, testContext, 100);
    const violations = auditor.getComplianceViolations();
    console.log('Violações de compliance:', violations.length);
    violations.forEach(v => {
      console.log(`- [${v.severity.toUpperCase()}] ${v.ruleName}: ${v.message}`);
    });

    // Teste 4: Consultas
    console.log('\n=== Teste 4: Consultas ===');
    const recentDecisions = await auditor.getRecentDecisions(5);
    console.log('Decisões recentes:', recentDecisions.length);

    const auditLog = auditor.getAuditLog({ limit: 10 });
    console.log('Audit log entries:', auditLog.length);

    // Teste 5: Export
    console.log('\n=== Teste 5: Export ===');
    const exported = auditor.exportAuditLog();
    console.log('Tamanho do export:', exported.length, 'caracteres');

    console.log('\n[AE2:M3] Status:', auditor.getStatus());
    console.log('\n[AE2:M3] ✓ Decision Auditor testado com sucesso');
  }

  runTests().catch(console.error);
}
