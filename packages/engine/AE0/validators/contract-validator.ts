import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';

/**
 * Contract Validator para AE0
 * Valida contratos de comunicação entre componentes do Arqos Engine
 */

interface ContractProvides {
  name: string;
  format: string;
  frequency: 'on_request' | 'periodic' | 'continuous';
  schema?: {
    type: string;
    required?: string[];
    properties?: Record<string, any>;
  };
}

interface ContractReceives {
  name: string;
  format: string;
  source: string;
  purpose?: string;
}

interface Contract {
  contract_id: string;
  version: string;
  provides?: ContractProvides[];
  receives?: ContractReceives[];
  [key: string]: any;
}

interface ValidationResult {
  contractPath: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ContractDependency {
  contractId: string;
  provider: string;
  consumer: string;
  dataFlows: string[];
}

/**
 * Carrega um contrato YAML
 */
async function loadContract(contractPath: string): Promise<Contract | null> {
  try {
    const content = await fs.readFile(contractPath, 'utf-8');
    const contract = YAML.parse(content);
    return contract as Contract;
  } catch (error) {
    console.error(`Erro ao carregar contrato ${contractPath}: ${error}`);
    return null;
  }
}

/**
 * Encontra todos os arquivos de contrato
 */
async function findContractFiles(contractsPath: string): Promise<string[]> {
  const contracts: string[] = [];

  try {
    const files = await fs.readdir(contractsPath);

    for (const file of files) {
      if (file.endsWith('.contract.yaml') || file.endsWith('.contract.yml')) {
        contracts.push(path.join(contractsPath, file));
      }
    }
  } catch (error) {
    throw new Error(`Erro ao ler diretório de contratos ${contractsPath}: ${error}`);
  }

  return contracts;
}

/**
 * Valida a estrutura básica de um contrato
 */
function validateContractStructure(contract: Contract, filePath: string): ValidationResult {
  const result: ValidationResult = {
    contractPath: filePath,
    valid: true,
    errors: [],
    warnings: []
  };

  // Validar campos obrigatórios
  if (!contract.contract_id) {
    result.errors.push('Campo obrigatório ausente: contract_id');
    result.valid = false;
  }

  if (!contract.version) {
    result.errors.push('Campo obrigatório ausente: version');
    result.valid = false;
  } else {
    // Validar formato de versão (semver básico)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(contract.version)) {
      result.errors.push(`Versão inválida: ${contract.version}. Use formato semver (ex: 1.0.0)`);
      result.valid = false;
    }
  }

  // Validar que tem pelo menos provides ou receives
  if (!contract.provides && !contract.receives) {
    result.errors.push('Contrato deve ter pelo menos "provides" ou "receives"');
    result.valid = false;
  }

  return result;
}

/**
 * Valida as cláusulas "provides" de um contrato
 */
function validateProvides(provides: ContractProvides[], result: ValidationResult): void {
  if (!Array.isArray(provides)) {
    result.errors.push('"provides" deve ser um array');
    result.valid = false;
    return;
  }

  provides.forEach((item, index) => {
    if (!item.name) {
      result.errors.push(`provides[${index}]: campo "name" obrigatório`);
      result.valid = false;
    }

    if (!item.format) {
      result.errors.push(`provides[${index}]: campo "format" obrigatório`);
      result.valid = false;
    }

    if (!item.frequency) {
      result.errors.push(`provides[${index}]: campo "frequency" obrigatório`);
      result.valid = false;
    } else {
      const validFrequencies = ['on_request', 'periodic', 'continuous'];
      if (!validFrequencies.includes(item.frequency)) {
        result.errors.push(
          `provides[${index}]: frequency inválida "${item.frequency}". ` +
          `Use: ${validFrequencies.join(', ')}`
        );
        result.valid = false;
      }
    }

    // Avisar se não tem schema definido
    if (!item.schema) {
      result.warnings.push(
        `provides[${index}] (${item.name}): schema não definido. ` +
        `Considere adicionar para melhor validação`
      );
    }
  });
}

/**
 * Valida as cláusulas "receives" de um contrato
 */
function validateReceives(receives: ContractReceives[], result: ValidationResult): void {
  if (!Array.isArray(receives)) {
    result.errors.push('"receives" deve ser um array');
    result.valid = false;
    return;
  }

  receives.forEach((item, index) => {
    if (!item.name) {
      result.errors.push(`receives[${index}]: campo "name" obrigatório`);
      result.valid = false;
    }

    if (!item.format) {
      result.errors.push(`receives[${index}]: campo "format" obrigatório`);
      result.valid = false;
    }

    if (!item.source) {
      result.errors.push(`receives[${index}]: campo "source" obrigatório`);
      result.valid = false;
    }

    // Avisar se não tem purpose definido
    if (!item.purpose) {
      result.warnings.push(
        `receives[${index}] (${item.name}): purpose não definido. ` +
        `Considere documentar o propósito`
      );
    }
  });
}

/**
 * Valida um contrato completo
 */
async function validateContract(contractPath: string): Promise<ValidationResult> {
  const contract = await loadContract(contractPath);

  if (!contract) {
    return {
      contractPath,
      valid: false,
      errors: ['Não foi possível carregar o contrato'],
      warnings: []
    };
  }

  // Validar estrutura básica
  const result = validateContractStructure(contract, contractPath);

  if (!result.valid) {
    return result; // Retornar early se estrutura inválida
  }

  // Validar provides
  if (contract.provides) {
    validateProvides(contract.provides, result);
  }

  // Validar receives
  if (contract.receives) {
    validateReceives(contract.receives, result);
  }

  return result;
}

/**
 * Analisa dependências entre contratos
 */
function analyzeDependencies(contracts: Map<string, Contract>): ContractDependency[] {
  const dependencies: ContractDependency[] = [];

  for (const [filePath, contract] of contracts.entries()) {
    if (!contract.provides || !contract.receives) continue;

    const fileName = path.basename(filePath, path.extname(filePath));
    const parts = fileName.split('-');

    if (parts.length >= 2) {
      const provider = parts[0].toUpperCase();
      const consumer = parts[1].toUpperCase();

      const dataFlows: string[] = [];
      contract.provides?.forEach(p => dataFlows.push(`${p.name} (${p.format})`));

      dependencies.push({
        contractId: contract.contract_id,
        provider,
        consumer,
        dataFlows
      });
    }
  }

  return dependencies;
}

/**
 * Valida todos os contratos do projeto
 *
 * @param contractsPath - Caminho para o diretório de contratos
 * @param verbose - Exibir logs detalhados
 * @throws Error se houver falhas críticas de validação
 */
export async function validateContracts(
  contractsPath: string,
  verbose: boolean = false
): Promise<void> {
  if (!contractsPath) {
    throw new Error("contractsPath is required");
  }

  console.log(`[AE0] Iniciando validação de contratos...`);
  console.log(`[AE0] Contracts path: ${contractsPath}`);

  // Encontrar arquivos de contrato
  const contractFiles = await findContractFiles(contractsPath);
  console.log(`[AE0] ✓ ${contractFiles.length} contratos encontrados`);

  if (contractFiles.length === 0) {
    console.warn(`[AE0] ⚠ Nenhum contrato encontrado em ${contractsPath}`);
    return;
  }

  // Validar cada contrato
  const results: ValidationResult[] = [];
  const loadedContracts = new Map<string, Contract>();

  let validCount = 0;
  let invalidCount = 0;
  let totalWarnings = 0;

  for (const contractFile of contractFiles) {
    const result = await validateContract(contractFile);
    results.push(result);

    if (result.valid) {
      validCount++;
      if (verbose) {
        console.log(`[AE0] ✓ ${path.basename(contractFile)}`);
        if (result.warnings.length > 0) {
          result.warnings.forEach(warn => console.log(`  ⚠ ${warn}`));
        }
      }

      // Carregar contrato para análise de dependências
      const contract = await loadContract(contractFile);
      if (contract) {
        loadedContracts.set(contractFile, contract);
      }
    } else {
      invalidCount++;
      console.error(`[AE0] ✗ ${path.basename(contractFile)}`);
      result.errors.forEach(err => console.error(`  - ${err}`));
      if (result.warnings.length > 0) {
        result.warnings.forEach(warn => console.log(`  ⚠ ${warn}`));
      }
    }

    totalWarnings += result.warnings.length;
  }

  // Análise de dependências (se todos os contratos válidos)
  if (invalidCount === 0 && verbose) {
    console.log(`\n[AE0] Analisando dependências entre contratos...`);
    const dependencies = analyzeDependencies(loadedContracts);

    dependencies.forEach(dep => {
      console.log(`[AE0] ${dep.provider} → ${dep.consumer}:`);
      dep.dataFlows.forEach(flow => console.log(`  - ${flow}`));
    });
  }

  // Resumo
  console.log(`\n[AE0] Validação de Contratos - Resumo:`);
  console.log(`  Total: ${results.length}`);
  console.log(`  Válidos: ${validCount}`);
  console.log(`  Inválidos: ${invalidCount}`);
  console.log(`  Avisos: ${totalWarnings}`);

  // Throw se houver erros
  if (invalidCount > 0) {
    throw new Error(
      `Validação de contratos falhou: ${invalidCount} contrato(s) inválido(s)`
    );
  }

  console.log(`[AE0] ✓ Todos os contratos validados com sucesso\n`);
}

/**
 * Valida um único contrato
 * Útil para validação sob demanda
 */
export async function validateSingleContract(
  contractPath: string
): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }> {
  const result = await validateContract(contractPath);

  return {
    valid: result.valid,
    errors: result.errors.length > 0 ? result.errors : undefined,
    warnings: result.warnings.length > 0 ? result.warnings : undefined
  };
}

// CLI execution
if (require.main === module) {
  const contractsPath = process.env.ARQOS_CONTRACTS_PATH || path.join(process.cwd(), 'interfaces');
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  validateContracts(contractsPath, verbose)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(`\n[AE0] ✗ Erro fatal: ${error.message}`);
      process.exit(1);
    });
}
