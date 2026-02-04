/**
 * Evolution Manager - Módulo M8 do AE2
 * Responsável por versionamento automático, upgrade de capacidades e gestão de mudanças
 */

import type {
  ModuleStatus,
  ReflectionReport,
  Recommendation
} from '../../types';

// ========== Configurações ==========

interface EvolutionManagerConfig {
  /** Versão atual do sistema */
  currentVersion: string;
  /** Habilitar auto-versioning */
  enableAutoVersioning: boolean;
  /** Threshold para upgrade automático */
  autoUpgradeThreshold: number;
  /** Número máximo de versões a manter no histórico */
  maxVersionHistory: number;
  /** Intervalo mínimo entre upgrades (ms) */
  minUpgradeInterval: number;
  /** Habilitar rollback automático */
  enableAutoRollback: boolean;
}

const DEFAULT_CONFIG: EvolutionManagerConfig = {
  currentVersion: '1.0.0',
  enableAutoVersioning: true,
  autoUpgradeThreshold: 0.7,
  maxVersionHistory: 50,
  minUpgradeInterval: 3600000, // 1 hora
  enableAutoRollback: true
};

// ========== Tipos Internos ==========

interface VersionInfo {
  version: string;
  timestamp: number;
  type: 'major' | 'minor' | 'patch';
  changes: VersionChange[];
  stable: boolean;
  metrics?: VersionMetrics;
}

interface VersionChange {
  type: 'feature' | 'improvement' | 'fix' | 'deprecation' | 'breaking';
  component: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

interface VersionMetrics {
  successRate: number;
  performanceScore: number;
  stabilityScore: number;
  adoptionTime: number;
}

interface Capability {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'deprecated' | 'experimental' | 'disabled';
  dependencies: string[];
  metrics: CapabilityMetrics;
  lastUpdated: number;
}

interface CapabilityMetrics {
  usageCount: number;
  successRate: number;
  avgExecutionTime: number;
  errorRate: number;
}

interface UpgradePlan {
  id: string;
  fromVersion: string;
  toVersion: string;
  capabilities: CapabilityUpgrade[];
  estimatedImpact: UpgradeImpact;
  steps: UpgradeStep[];
  rollbackPlan: RollbackPlan;
  createdAt: number;
}

interface CapabilityUpgrade {
  capabilityId: string;
  action: 'add' | 'update' | 'remove' | 'deprecate';
  fromVersion?: string;
  toVersion?: string;
  reason: string;
}

interface UpgradeImpact {
  riskLevel: 'high' | 'medium' | 'low';
  downtime: number;
  affectedComponents: string[];
  requiredValidation: string[];
}

interface UpgradeStep {
  order: number;
  action: string;
  target: string;
  validation?: string;
  rollbackAction?: string;
}

interface RollbackPlan {
  enabled: boolean;
  checkpoints: string[];
  maxRollbackTime: number;
  preserveData: boolean;
}

interface EvolutionGap {
  type: 'missing_capability' | 'outdated_version' | 'performance_issue' | 'compatibility';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedAction: string;
  affectedComponents: string[];
}

interface EvolutionMetrics {
  currentVersion: string;
  upgradeCount: number;
  rollbackCount: number;
  avgUpgradeTime: number;
  stabilityScore: number;
  evolutionVelocity: number;
}

// ========== Classe Principal ==========

export class EvolutionManager {
  private config: EvolutionManagerConfig;
  private initialized = false;
  private lastActivity?: number;

  // Estado
  private versionHistory: VersionInfo[] = [];
  private capabilities: Map<string, Capability> = new Map();
  private pendingUpgrades: UpgradePlan[] = [];
  private evolutionGaps: EvolutionGap[] = [];

  // Métricas
  private upgradeCount = 0;
  private rollbackCount = 0;
  private lastUpgradeTime?: number;

  constructor(config: Partial<EvolutionManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Registrar versão inicial
    this.versionHistory.push({
      version: this.config.currentVersion,
      timestamp: Date.now(),
      type: 'major',
      changes: [],
      stable: true
    });
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M8] Evolution Manager initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();

    // Registrar capacidades base
    this.registerBaseCapabilities();

    console.log('[AE2:M8] Evolution Manager initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'EvolutionManager',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        currentVersion: this.config.currentVersion,
        upgradeCount: this.upgradeCount,
        rollbackCount: this.rollbackCount,
        registeredCapabilities: this.capabilities.size,
        pendingUpgrades: this.pendingUpgrades.length,
        identifiedGaps: this.evolutionGaps.length,
        versionHistorySize: this.versionHistory.length
      }
    };
  }

  // ========== Versionamento ==========

  /**
   * Obtém a versão atual
   */
  getCurrentVersion(): string {
    return this.config.currentVersion;
  }

  /**
   * Calcula a próxima versão
   */
  getNextVersion(type: 'major' | 'minor' | 'patch' = 'patch'): string {
    const parts = this.config.currentVersion.split('.').map(Number);
    const [major, minor, patch] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Auto-versioning baseado em mudanças
   */
  autoVersion(changes: VersionChange[] = []): VersionInfo {
    console.log('[AE2:M8] Running auto-versioning...');
    this.lastActivity = Date.now();

    if (!this.config.enableAutoVersioning) {
      return this.versionHistory[this.versionHistory.length - 1];
    }

    // Determinar tipo de versão baseado nas mudanças
    const versionType = this.determineVersionType(changes);
    const newVersion = this.getNextVersion(versionType);

    const versionInfo: VersionInfo = {
      version: newVersion,
      timestamp: Date.now(),
      type: versionType,
      changes,
      stable: versionType === 'patch'
    };

    // Atualizar histórico
    this.versionHistory.push(versionInfo);
    if (this.versionHistory.length > this.config.maxVersionHistory) {
      this.versionHistory.shift();
    }

    // Atualizar versão atual
    this.config.currentVersion = newVersion;

    console.log(`[AE2:M8] Version updated: ${newVersion} (${versionType})`);
    return versionInfo;
  }

  /**
   * Obtém histórico de versões
   */
  getVersionHistory(): VersionInfo[] {
    return [...this.versionHistory];
  }

  private determineVersionType(changes: VersionChange[]): 'major' | 'minor' | 'patch' {
    if (changes.some(c => c.type === 'breaking')) {
      return 'major';
    }
    if (changes.some(c => c.type === 'feature' || c.type === 'deprecation')) {
      return 'minor';
    }
    return 'patch';
  }

  // ========== Gestão de Capacidades ==========

  /**
   * Registra uma nova capacidade
   */
  registerCapability(capability: Omit<Capability, 'metrics' | 'lastUpdated'>): void {
    const fullCapability: Capability = {
      ...capability,
      metrics: {
        usageCount: 0,
        successRate: 1,
        avgExecutionTime: 0,
        errorRate: 0
      },
      lastUpdated: Date.now()
    };

    this.capabilities.set(capability.id, fullCapability);
    console.log(`[AE2:M8] Capability registered: ${capability.name} (${capability.id})`);
  }

  /**
   * Atualiza métricas de uma capacidade
   */
  updateCapabilityMetrics(
    capabilityId: string,
    metrics: Partial<CapabilityMetrics>
  ): void {
    const capability = this.capabilities.get(capabilityId);
    if (capability) {
      Object.assign(capability.metrics, metrics);
      capability.lastUpdated = Date.now();
    }
  }

  /**
   * Obtém todas as capacidades
   */
  getCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Obtém capacidades por status
   */
  getCapabilitiesByStatus(status: Capability['status']): Capability[] {
    return Array.from(this.capabilities.values())
      .filter(c => c.status === status);
  }

  /**
   * Deprecia uma capacidade
   */
  deprecateCapability(capabilityId: string, reason: string): void {
    const capability = this.capabilities.get(capabilityId);
    if (capability) {
      capability.status = 'deprecated';
      capability.lastUpdated = Date.now();

      // Registrar mudança
      this.autoVersion([{
        type: 'deprecation',
        component: capability.name,
        description: reason,
        impact: 'medium'
      }]);
    }
  }

  private registerBaseCapabilities(): void {
    // Registrar capacidades base do sistema
    const baseCapabilities: Omit<Capability, 'metrics' | 'lastUpdated'>[] = [
      { id: 'strategic_analysis', name: 'Strategic Analysis', version: '1.0.0', status: 'active', dependencies: [] },
      { id: 'orchestration', name: 'Orchestration', version: '1.0.0', status: 'active', dependencies: ['strategic_analysis'] },
      { id: 'decision_audit', name: 'Decision Audit', version: '1.0.0', status: 'active', dependencies: ['orchestration'] },
      { id: 'distributed_execution', name: 'Distributed Execution', version: '1.0.0', status: 'active', dependencies: ['orchestration'] },
      { id: 'contextual_awareness', name: 'Contextual Awareness', version: '1.0.0', status: 'active', dependencies: [] },
      { id: 'predictive_optimization', name: 'Predictive Optimization', version: '1.0.0', status: 'active', dependencies: ['strategic_analysis', 'contextual_awareness'] },
      { id: 'self_reflection', name: 'Self Reflection', version: '1.0.0', status: 'active', dependencies: ['decision_audit'] },
      { id: 'evolution', name: 'Evolution Management', version: '1.0.0', status: 'active', dependencies: ['self_reflection'] }
    ];

    for (const cap of baseCapabilities) {
      this.registerCapability(cap);
    }
  }

  // ========== Upgrade de Capacidades ==========

  /**
   * Analisa gaps e gera plano de upgrade
   */
  upgradeCapabilities(gaps: string[]): UpgradePlan {
    console.log('[AE2:M8] Analyzing upgrade requirements...');
    this.lastActivity = Date.now();

    // Identificar gaps
    this.identifyGaps(gaps);

    // Gerar upgrades necessários
    const capabilityUpgrades = this.planCapabilityUpgrades();

    // Calcular impacto
    const impact = this.estimateUpgradeImpact(capabilityUpgrades);

    // Gerar steps
    const steps = this.generateUpgradeSteps(capabilityUpgrades);

    // Criar plano de rollback
    const rollbackPlan = this.createRollbackPlan(capabilityUpgrades);

    const plan: UpgradePlan = {
      id: `upgrade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromVersion: this.config.currentVersion,
      toVersion: this.getNextVersion('minor'),
      capabilities: capabilityUpgrades,
      estimatedImpact: impact,
      steps,
      rollbackPlan,
      createdAt: Date.now()
    };

    this.pendingUpgrades.push(plan);
    this.upgradeCount++;

    console.log(`[AE2:M8] Upgrade plan created: ${plan.id} (${capabilityUpgrades.length} capabilities)`);
    return plan;
  }

  /**
   * Executa um plano de upgrade
   */
  async executeUpgrade(planId: string): Promise<{
    success: boolean;
    newVersion: string;
    errors: string[];
  }> {
    const plan = this.pendingUpgrades.find(p => p.id === planId);
    if (!plan) {
      return {
        success: false,
        newVersion: this.config.currentVersion,
        errors: ['Upgrade plan not found']
      };
    }

    console.log(`[AE2:M8] Executing upgrade plan ${planId}...`);
    const errors: string[] = [];

    // Executar steps
    for (const step of plan.steps) {
      try {
        await this.executeUpgradeStep(step);
      } catch (error) {
        errors.push(`Step ${step.order} failed: ${error}`);
        if (this.config.enableAutoRollback && plan.rollbackPlan.enabled) {
          console.log('[AE2:M8] Initiating rollback...');
          await this.rollback(plan);
          this.rollbackCount++;
          return {
            success: false,
            newVersion: this.config.currentVersion,
            errors: [...errors, 'Rollback executed']
          };
        }
      }
    }

    // Aplicar upgrades de capacidades
    for (const upgrade of plan.capabilities) {
      this.applyCapabilityUpgrade(upgrade);
    }

    // Atualizar versão
    const versionInfo = this.autoVersion(
      plan.capabilities.map(u => ({
        type: u.action === 'add' ? 'feature' : u.action === 'remove' ? 'deprecation' : 'improvement',
        component: u.capabilityId,
        description: u.reason,
        impact: 'medium' as const
      }))
    );

    // Remover do pendentes
    this.pendingUpgrades = this.pendingUpgrades.filter(p => p.id !== planId);
    this.lastUpgradeTime = Date.now();

    return {
      success: errors.length === 0,
      newVersion: versionInfo.version,
      errors
    };
  }

  private identifyGaps(gaps: string[]): void {
    this.evolutionGaps = [];

    for (const gap of gaps) {
      // Analisar tipo de gap
      let evolutionGap: EvolutionGap;

      if (gap.includes('missing') || gap.includes('need')) {
        evolutionGap = {
          type: 'missing_capability',
          description: gap,
          severity: 'high',
          suggestedAction: `Add capability: ${gap}`,
          affectedComponents: [gap]
        };
      } else if (gap.includes('slow') || gap.includes('performance')) {
        evolutionGap = {
          type: 'performance_issue',
          description: gap,
          severity: 'medium',
          suggestedAction: 'Optimize performance',
          affectedComponents: [gap]
        };
      } else if (gap.includes('outdated') || gap.includes('version')) {
        evolutionGap = {
          type: 'outdated_version',
          description: gap,
          severity: 'medium',
          suggestedAction: 'Update to latest version',
          affectedComponents: [gap]
        };
      } else {
        evolutionGap = {
          type: 'compatibility',
          description: gap,
          severity: 'low',
          suggestedAction: `Review compatibility: ${gap}`,
          affectedComponents: [gap]
        };
      }

      this.evolutionGaps.push(evolutionGap);
    }
  }

  private planCapabilityUpgrades(): CapabilityUpgrade[] {
    const upgrades: CapabilityUpgrade[] = [];

    for (const gap of this.evolutionGaps) {
      switch (gap.type) {
        case 'missing_capability':
          upgrades.push({
            capabilityId: gap.description.replace(/\s+/g, '_').toLowerCase(),
            action: 'add',
            toVersion: '1.0.0',
            reason: gap.suggestedAction
          });
          break;

        case 'outdated_version':
          for (const component of gap.affectedComponents) {
            const capability = this.capabilities.get(component);
            if (capability) {
              upgrades.push({
                capabilityId: component,
                action: 'update',
                fromVersion: capability.version,
                toVersion: this.incrementVersion(capability.version),
                reason: gap.suggestedAction
              });
            }
          }
          break;

        case 'performance_issue':
          for (const component of gap.affectedComponents) {
            upgrades.push({
              capabilityId: component,
              action: 'update',
              reason: 'Performance optimization'
            });
          }
          break;
      }
    }

    return upgrades;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    return parts.join('.');
  }

  private estimateUpgradeImpact(upgrades: CapabilityUpgrade[]): UpgradeImpact {
    const affectedComponents = upgrades.map(u => u.capabilityId);
    const hasAdditions = upgrades.some(u => u.action === 'add');
    const hasRemovals = upgrades.some(u => u.action === 'remove');

    let riskLevel: UpgradeImpact['riskLevel'] = 'low';
    if (hasRemovals) {
      riskLevel = 'high';
    } else if (hasAdditions && upgrades.length > 3) {
      riskLevel = 'medium';
    }

    return {
      riskLevel,
      downtime: riskLevel === 'high' ? 5000 : riskLevel === 'medium' ? 2000 : 0,
      affectedComponents,
      requiredValidation: upgrades.map(u => `validate_${u.capabilityId}`)
    };
  }

  private generateUpgradeSteps(upgrades: CapabilityUpgrade[]): UpgradeStep[] {
    const steps: UpgradeStep[] = [];
    let order = 0;

    // Step 1: Backup
    steps.push({
      order: ++order,
      action: 'backup',
      target: 'system_state',
      validation: 'verify_backup_integrity',
      rollbackAction: 'restore_backup'
    });

    // Step 2: Validação pré-upgrade
    steps.push({
      order: ++order,
      action: 'validate',
      target: 'dependencies',
      validation: 'check_dependencies'
    });

    // Steps para cada upgrade
    for (const upgrade of upgrades) {
      steps.push({
        order: ++order,
        action: upgrade.action,
        target: upgrade.capabilityId,
        validation: `validate_${upgrade.action}_${upgrade.capabilityId}`,
        rollbackAction: this.getRollbackAction(upgrade)
      });
    }

    // Step final: Verificação
    steps.push({
      order: ++order,
      action: 'verify',
      target: 'system_health',
      validation: 'run_health_checks'
    });

    return steps;
  }

  private getRollbackAction(upgrade: CapabilityUpgrade): string {
    switch (upgrade.action) {
      case 'add':
        return `remove_${upgrade.capabilityId}`;
      case 'remove':
        return `restore_${upgrade.capabilityId}`;
      case 'update':
        return `revert_${upgrade.capabilityId}_to_${upgrade.fromVersion}`;
      default:
        return `undo_${upgrade.action}_${upgrade.capabilityId}`;
    }
  }

  private createRollbackPlan(upgrades: CapabilityUpgrade[]): RollbackPlan {
    return {
      enabled: this.config.enableAutoRollback,
      checkpoints: upgrades.map((_, i) => `checkpoint_${i + 1}`),
      maxRollbackTime: 30000,
      preserveData: true
    };
  }

  private async executeUpgradeStep(step: UpgradeStep): Promise<void> {
    console.log(`[AE2:M8] Executing step ${step.order}: ${step.action} ${step.target}`);
    // Simular execução
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async rollback(plan: UpgradePlan): Promise<void> {
    console.log(`[AE2:M8] Rolling back upgrade ${plan.id}...`);
    // Simular rollback
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('[AE2:M8] Rollback completed');
  }

  private applyCapabilityUpgrade(upgrade: CapabilityUpgrade): void {
    switch (upgrade.action) {
      case 'add':
        this.registerCapability({
          id: upgrade.capabilityId,
          name: upgrade.capabilityId.replace(/_/g, ' '),
          version: upgrade.toVersion || '1.0.0',
          status: 'experimental',
          dependencies: []
        });
        break;

      case 'update':
        const capability = this.capabilities.get(upgrade.capabilityId);
        if (capability && upgrade.toVersion) {
          capability.version = upgrade.toVersion;
          capability.lastUpdated = Date.now();
        }
        break;

      case 'remove':
      case 'deprecate':
        this.deprecateCapability(upgrade.capabilityId, upgrade.reason);
        break;
    }
  }

  // ========== Evolução Baseada em Reflexão ==========

  /**
   * Evolui o sistema baseado em relatório de reflexão
   */
  async evolve(currentVersion: string, gaps: string[]): Promise<{
    versioning: VersionInfo;
    upgrades: UpgradePlan | null;
  }> {
    console.log('[AE2:M8] Starting evolution process...');
    this.lastActivity = Date.now();

    // Sincronizar versão
    if (currentVersion !== this.config.currentVersion) {
      this.config.currentVersion = currentVersion;
    }

    // Verificar intervalo mínimo
    if (this.lastUpgradeTime &&
        Date.now() - this.lastUpgradeTime < this.config.minUpgradeInterval) {
      console.log('[AE2:M8] Minimum upgrade interval not reached, skipping');
      return {
        versioning: this.versionHistory[this.versionHistory.length - 1],
        upgrades: null
      };
    }

    // Gerar plano de upgrade se houver gaps
    let upgradePlan: UpgradePlan | null = null;
    if (gaps.length > 0) {
      upgradePlan = this.upgradeCapabilities(gaps);
    }

    // Auto-versioning
    const versionInfo = this.autoVersion(
      gaps.map(gap => ({
        type: 'improvement' as const,
        component: 'system',
        description: gap,
        impact: 'low' as const
      }))
    );

    console.log('[AE2:M8] Evolution process completed');
    return {
      versioning: versionInfo,
      upgrades: upgradePlan
    };
  }

  /**
   * Processa recomendações de reflexão
   */
  processReflectionRecommendations(recommendations: Recommendation[]): EvolutionGap[] {
    const newGaps: EvolutionGap[] = [];

    for (const rec of recommendations) {
      if (rec.actionable && rec.priority !== 'low') {
        const gap: EvolutionGap = {
          type: rec.type === 'warning' ? 'performance_issue' :
                rec.type === 'optimization' ? 'outdated_version' : 'compatibility',
          description: rec.description,
          severity: rec.priority === 'critical' ? 'critical' :
                    rec.priority === 'high' ? 'high' : 'medium',
          suggestedAction: rec.description,
          affectedComponents: []
        };
        newGaps.push(gap);
      }
    }

    this.evolutionGaps.push(...newGaps);
    return newGaps;
  }

  // ========== Métricas de Evolução ==========

  /**
   * Obtém métricas de evolução
   */
  getEvolutionMetrics(): EvolutionMetrics {
    const recentUpgrades = this.versionHistory.filter(v =>
      v.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000 // Última semana
    );

    const stableVersions = this.versionHistory.filter(v => v.stable);
    const stabilityScore = stableVersions.length / Math.max(1, this.versionHistory.length);

    return {
      currentVersion: this.config.currentVersion,
      upgradeCount: this.upgradeCount,
      rollbackCount: this.rollbackCount,
      avgUpgradeTime: this.upgradeCount > 0
        ? (Date.now() - (this.versionHistory[0]?.timestamp ?? Date.now())) / this.upgradeCount
        : 0,
      stabilityScore,
      evolutionVelocity: recentUpgrades.length / 7 // Upgrades por dia
    };
  }

  /**
   * Obtém gaps identificados
   */
  getIdentifiedGaps(): EvolutionGap[] {
    return [...this.evolutionGaps];
  }

  /**
   * Obtém upgrades pendentes
   */
  getPendingUpgrades(): UpgradePlan[] {
    return [...this.pendingUpgrades];
  }
}

// ========== Funções Exportadas (Compatibilidade) ==========

export function autoVersion(currentVersion: string): { next_version: string } {
  const parts = currentVersion.split('.').map(Number);
  const [major, minor, patch] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  const next = [major, minor, patch + 1].join('.');

  return { next_version: next };
}

export function upgradeCapabilities(gaps: string[]): { upgrades: string[] } {
  if (!gaps.length) {
    return { upgrades: ['no_action'] };
  }

  return { upgrades: gaps.map(gap => `upgrade_${gap}`) };
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M8] Testando Evolution Manager...\n');

  async function runTests() {
    const evolution = new EvolutionManager({
      currentVersion: '1.3.2'
    });
    await evolution.initialize();

    // Teste 1: Versão atual
    console.log('=== Teste 1: Versão Atual ===');
    console.log('Versão:', evolution.getCurrentVersion());
    console.log('Próxima patch:', evolution.getNextVersion('patch'));
    console.log('Próxima minor:', evolution.getNextVersion('minor'));
    console.log('Próxima major:', evolution.getNextVersion('major'));

    // Teste 2: Capacidades
    console.log('\n=== Teste 2: Capacidades ===');
    const capabilities = evolution.getCapabilities();
    console.log('Capacidades registradas:', capabilities.length);
    console.log('Ativas:', evolution.getCapabilitiesByStatus('active').length);

    // Teste 3: Registrar nova capacidade
    console.log('\n=== Teste 3: Nova Capacidade ===');
    evolution.registerCapability({
      id: 'advanced_analytics',
      name: 'Advanced Analytics',
      version: '1.0.0',
      status: 'experimental',
      dependencies: ['predictive_optimization']
    });
    console.log('Nova capacidade registrada');
    console.log('Total capacidades:', evolution.getCapabilities().length);

    // Teste 4: Auto-versioning
    console.log('\n=== Teste 4: Auto-Versioning ===');
    const version = evolution.autoVersion([
      { type: 'feature', component: 'analytics', description: 'Added analytics module', impact: 'medium' },
      { type: 'improvement', component: 'performance', description: 'Optimized queries', impact: 'low' }
    ]);
    console.log('Nova versão:', version.version);
    console.log('Tipo:', version.type);

    // Teste 5: Plano de upgrade
    console.log('\n=== Teste 5: Plano de Upgrade ===');
    const upgradePlan = evolution.upgradeCapabilities([
      'missing_nlp_capability',
      'outdated_search_version',
      'slow_response_time'
    ]);
    console.log('Plano criado:', upgradePlan.id);
    console.log('De:', upgradePlan.fromVersion, '-> Para:', upgradePlan.toVersion);
    console.log('Upgrades:', upgradePlan.capabilities.length);
    console.log('Risco:', upgradePlan.estimatedImpact.riskLevel);
    console.log('Steps:', upgradePlan.steps.length);

    // Teste 6: Executar upgrade
    console.log('\n=== Teste 6: Executar Upgrade ===');
    const result = await evolution.executeUpgrade(upgradePlan.id);
    console.log('Sucesso:', result.success);
    console.log('Nova versão:', result.newVersion);
    if (result.errors.length > 0) {
      console.log('Erros:', result.errors);
    }

    // Teste 7: Evolução completa
    console.log('\n=== Teste 7: Evolução Completa ===');
    const evolutionResult = await evolution.evolve(
      evolution.getCurrentVersion(),
      ['need_better_caching', 'performance_degradation']
    );
    console.log('Versão:', evolutionResult.versioning.version);
    console.log('Upgrade planejado:', evolutionResult.upgrades !== null);

    // Teste 8: Métricas
    console.log('\n=== Teste 8: Métricas de Evolução ===');
    const metrics = evolution.getEvolutionMetrics();
    console.log('Versão atual:', metrics.currentVersion);
    console.log('Upgrades realizados:', metrics.upgradeCount);
    console.log('Rollbacks:', metrics.rollbackCount);
    console.log('Score de estabilidade:', (metrics.stabilityScore * 100).toFixed(1) + '%');

    console.log('\n[AE2:M8] Status:', evolution.getStatus());
    console.log('\n[AE2:M8] ✓ Evolution Manager testado com sucesso');
  }

  runTests().catch(console.error);
}
