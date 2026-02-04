/**
 * Mode Validator para AE0
 * Valida e resolve o modo operacional do Arqos Engine
 */

export type OperationalMode = 'lite' | 'fullstack';

interface ModeConfig {
  mode: OperationalMode;
  description: string;
  features: {
    ae0: string[];
    ae1: string[];
    ae2: string[];
    ae3: string[];
  };
}

const MODE_CONFIGS: Record<OperationalMode, ModeConfig> = {
  lite: {
    mode: 'lite',
    description: 'Minimal overhead for testing and development',
    features: {
      ae0: ['basic_validation', 'simple_circuit_breaker'],
      ae1: ['short_term_memory_only', 'in_memory_store'],
      ae2: ['3_modules', 'deterministic_decisions', 'legacy_orchestration'],
      ae3: ['5_essential_tools', 'sequential_execution']
    }
  },
  fullstack: {
    mode: 'fullstack',
    description: 'Production-grade with all features enabled',
    features: {
      ae0: ['complete_validation', 'advanced_circuit_breaker', 'health_monitoring'],
      ae1: ['3_layer_memory', 'embedding', 'learning_engine', 'persistent_store'],
      ae2: ['8_modules', 'adaptive_decisions', 'internal_flow_orchestration', '8_cognitive_contracts'],
      ae3: ['40_plus_tools', 'parallel_execution', 'plugin_system']
    }
  }
};

/**
 * Valida o modo operacional
 *
 * @param mode - Modo a ser validado ('lite' | 'fullstack')
 * @returns true se válido
 * @throws Error se modo inválido
 */
export function validateMode(mode: string): mode is OperationalMode {
  const validModes: OperationalMode[] = ['lite', 'fullstack'];

  if (!validModes.includes(mode as OperationalMode)) {
    throw new Error(
      `Modo operacional inválido: "${mode}". Use: ${validModes.join(' ou ')}`
    );
  }

  return true;
}

/**
 * Resolve o modo operacional a partir de múltiplas fontes
 * Ordem de prioridade:
 * 1. Argumento explícito
 * 2. Variável de ambiente ARQOS_MODE
 * 3. Default: 'lite'
 *
 * @param explicitMode - Modo explicitamente fornecido (opcional)
 * @returns Modo operacional validado
 */
export function resolveMode(explicitMode?: string): OperationalMode {
  // 1. Modo explícito (maior prioridade)
  if (explicitMode) {
    if (validateMode(explicitMode)) {
      console.log(`[AE0] Modo resolvido: ${explicitMode} (explícito)`);
      return explicitMode as OperationalMode;
    }
  }

  // 2. Variável de ambiente
  const envMode = process.env.ARQOS_MODE;
  if (envMode) {
    if (validateMode(envMode)) {
      console.log(`[AE0] Modo resolvido: ${envMode} (ARQOS_MODE)`);
      return envMode as OperationalMode;
    }
  }

  // 3. Default
  const defaultMode: OperationalMode = 'lite';
  console.log(`[AE0] Modo resolvido: ${defaultMode} (default)`);
  return defaultMode;
}

/**
 * Obtém a configuração para um modo específico
 *
 * @param mode - Modo operacional
 * @returns Configuração do modo
 */
export function getModeConfig(mode: OperationalMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * Verifica se uma feature está habilitada no modo atual
 *
 * @param mode - Modo operacional
 * @param component - Componente (ae0, ae1, ae2, ae3)
 * @param feature - Feature a verificar
 * @returns true se habilitada
 */
export function isFeatureEnabled(
  mode: OperationalMode,
  component: keyof ModeConfig['features'],
  feature: string
): boolean {
  const config = getModeConfig(mode);
  return config.features[component].includes(feature);
}

/**
 * Exibe informações sobre o modo operacional
 *
 * @param mode - Modo operacional
 */
export function logModeInfo(mode: OperationalMode): void {
  const config = getModeConfig(mode);

  console.log(`\n[AE0] ======================================`);
  console.log(`[AE0] Modo Operacional: ${config.mode.toUpperCase()}`);
  console.log(`[AE0] ${config.description}`);
  console.log(`[AE0] ======================================`);

  console.log(`\n[AE0] Features Habilitadas:`);
  console.log(`  AE0 (Bootstrap):`);
  config.features.ae0.forEach(f => console.log(`    - ${f.replace(/_/g, ' ')}`));

  console.log(`  AE1 (DNABase):`);
  config.features.ae1.forEach(f => console.log(`    - ${f.replace(/_/g, ' ')}`));

  console.log(`  AE2 (Strategos):`);
  config.features.ae2.forEach(f => console.log(`    - ${f.replace(/_/g, ' ')}`));

  console.log(`  AE3 (Pipeline):`);
  config.features.ae3.forEach(f => console.log(`    - ${f.replace(/_/g, ' ')}`));

  console.log(`[AE0] ======================================\n`);
}

// CLI execution
if (require.main === module) {
  const argMode = process.argv[2];
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  try {
    const mode = resolveMode(argMode);

    if (verbose) {
      logModeInfo(mode);
    } else {
      console.log(`[AE0] Modo validado: ${mode}`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`[AE0] ✗ ${(error as Error).message}`);
    process.exit(1);
  }
}
