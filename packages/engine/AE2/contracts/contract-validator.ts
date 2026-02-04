import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

/**
 * Representa um contrato cognitivo entre módulos
 */
type CognitiveContract = {
  contract_id: string;
  version: string;
  enabled_in: "lite" | "fullstack";
  validation?: {
    payload_schema_match?: boolean;
    response_timeout_ms?: number;
    retry_policy?: string;
  };
  [key: string]: unknown;
};

/**
 * Resultado da validação de um contrato
 */
type ValidationResult = {
  contract_id: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Cache de contratos carregados
 */
const contractCache = new Map<string, CognitiveContract>();

/**
 * Carrega um contrato YAML do disco
 */
function loadContract(contractPath: string): CognitiveContract {
  // Verificar cache
  if (contractCache.has(contractPath)) {
    return contractCache.get(contractPath)!;
  }

  // Verificar se arquivo existe
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract file not found: ${contractPath}`);
  }

  // Ler e parsear YAML
  const content = fs.readFileSync(contractPath, "utf-8");
  const contract = yaml.parse(content) as CognitiveContract;

  // Validar estrutura básica
  if (!contract.contract_id) {
    throw new Error(`Missing contract_id in ${contractPath}`);
  }

  if (!contract.version) {
    throw new Error(`Missing version in ${contractPath}`);
  }

  // Cachear contrato
  contractCache.set(contractPath, contract);

  return contract;
}

/**
 * Valida um único contrato cognitivo
 */
function validateSingleContract(
  contract: CognitiveContract,
  mode: "lite" | "fullstack"
): ValidationResult {
  const result: ValidationResult = {
    contract_id: contract.contract_id,
    valid: true,
    errors: [],
    warnings: [],
  };

  // Validação 1: Verificar se contrato está habilitado no modo atual
  if (contract.enabled_in && contract.enabled_in !== mode && mode !== "fullstack") {
    result.warnings.push(
      `Contract is enabled for '${contract.enabled_in}' mode, but running in '${mode}' mode`
    );
  }

  // Validação 2: Verificar contract_id formato
  if (!/^m\d+_m\d+_/.test(contract.contract_id)) {
    result.errors.push(`Invalid contract_id format: ${contract.contract_id}`);
    result.valid = false;
  }

  // Validação 3: Verificar version formato (semantic versioning)
  if (!/^\d+\.\d+\.\d+$/.test(contract.version)) {
    result.errors.push(`Invalid version format: ${contract.version}`);
    result.valid = false;
  }

  // Validação 4: Verificar schema de payload (se especificado)
  const moduleKeys = Object.keys(contract).filter((key) => /^m\d+_provides$/.test(key));

  if (moduleKeys.length === 0) {
    result.warnings.push("No module provides sections found");
  } else {
    moduleKeys.forEach((key) => {
      const provides = contract[key] as Array<{
        name?: string;
        format?: string;
        frequency?: string;
        schema?: {
          type?: string;
          required?: string[];
          properties?: Record<string, unknown>;
        };
      }>;

      if (!Array.isArray(provides)) {
        result.errors.push(`${key} must be an array`);
        result.valid = false;
        return;
      }

      provides.forEach((item, index) => {
        if (!item.name) {
          result.errors.push(`${key}[${index}] missing 'name' field`);
          result.valid = false;
        }

        if (!item.format) {
          result.errors.push(`${key}[${index}] missing 'format' field`);
          result.valid = false;
        }

        if (!item.frequency) {
          result.warnings.push(`${key}[${index}] missing 'frequency' field`);
        }

        // Validar schema se presente
        if (item.schema) {
          if (!item.schema.type) {
            result.warnings.push(`${key}[${index}].schema missing 'type' field`);
          }

          if (!item.schema.required || !Array.isArray(item.schema.required)) {
            result.warnings.push(
              `${key}[${index}].schema missing or invalid 'required' field`
            );
          }
        }
      });
    });
  }

  // Validação 5: Verificar configuração de validation
  if (contract.validation) {
    const validation = contract.validation;

    if (
      validation.response_timeout_ms &&
      (validation.response_timeout_ms < 100 || validation.response_timeout_ms > 60000)
    ) {
      result.warnings.push(
        `response_timeout_ms (${validation.response_timeout_ms}) outside recommended range (100-60000ms)`
      );
    }

    if (
      validation.retry_policy &&
      !["exponential_backoff", "linear", "none"].includes(validation.retry_policy)
    ) {
      result.warnings.push(
        `Unknown retry_policy: ${validation.retry_policy}`
      );
    }
  }

  return result;
}

/**
 * Obtém lista de todos os contratos no diretório
 */
function getAllContractPaths(contractsDir: string): string[] {
  if (!fs.existsSync(contractsDir)) {
    throw new Error(`Contracts directory not found: ${contractsDir}`);
  }

  const files = fs.readdirSync(contractsDir);
  return files
    .filter((file) => file.endsWith(".contract.yaml"))
    .map((file) => path.join(contractsDir, file));
}

/**
 * Valida todos os contratos cognitivos do AE2
 *
 * @param mode - Modo operacional (lite ou fullstack)
 * @param contractsDir - Diretório dos contratos (opcional, default: AE2/contracts)
 * @returns true se todos os contratos forem válidos, false caso contrário
 */
export async function validateContracts(
  mode: "lite" | "fullstack" = "fullstack",
  contractsDir?: string
): Promise<boolean> {
  const dir =
    contractsDir ?? path.join(__dirname, "..", "contracts");

  console.log(`[AE2:ContractValidator] Validating contracts in ${dir}...`);

  try {
    const contractPaths = getAllContractPaths(dir);
    console.log(`[AE2:ContractValidator] Found ${contractPaths.length} contracts`);

    if (contractPaths.length === 0) {
      console.warn("[AE2:ContractValidator] ⚠️  No contracts found");
      return false;
    }

    const results: ValidationResult[] = [];
    let hasErrors = false;

    for (const contractPath of contractPaths) {
      try {
        const contract = loadContract(contractPath);
        const result = validateSingleContract(contract, mode);
        results.push(result);

        if (!result.valid) {
          hasErrors = true;
        }
      } catch (error) {
        console.error(
          `[AE2:ContractValidator] ❌ Error loading contract ${path.basename(contractPath)}:`,
          error instanceof Error ? error.message : error
        );
        hasErrors = true;
      }
    }

    // Relatório de validação
    console.log("\n[AE2:ContractValidator] Validation Report:");
    console.log("=".repeat(60));

    results.forEach((result) => {
      const status = result.valid ? "✓" : "✗";
      const color = result.valid ? "" : "";
      console.log(`${color}${status} ${result.contract_id} (v${result.errors.length + result.warnings.length === 0 ? "valid" : `${result.errors.length} errors, ${result.warnings.length} warnings`})`);

      if (result.errors.length > 0) {
        result.errors.forEach((err) => {
          console.log(`    ❌ ERROR: ${err}`);
        });
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach((warn) => {
          console.log(`    ⚠️  WARNING: ${warn}`);
        });
      }
    });

    console.log("=".repeat(60));

    const validCount = results.filter((r) => r.valid).length;
    console.log(
      `\n[AE2:ContractValidator] Result: ${validCount}/${results.length} contracts valid`
    );

    if (hasErrors) {
      console.error(
        "[AE2:ContractValidator] ❌ Contract validation FAILED"
      );
      return false;
    }

    console.log("[AE2:ContractValidator] ✓ All contracts validated successfully");
    return true;
  } catch (error) {
    console.error(
      "[AE2:ContractValidator] ❌ Fatal error during validation:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Valida um contrato específico por ID
 */
export async function validateContractById(
  contractId: string,
  mode: "lite" | "fullstack" = "fullstack",
  contractsDir?: string
): Promise<boolean> {
  const dir = contractsDir ?? path.join(__dirname, "..", "contracts");

  try {
    const contractPaths = getAllContractPaths(dir);
    const normalizedSearch = contractId.toLowerCase().replace(/[_-]/g, "");
    const targetPath = contractPaths.find((p) => {
      const filename = path.basename(p).toLowerCase().replace(/[_-]/g, "");
      return filename.includes(normalizedSearch);
    });

    if (!targetPath) {
      console.error(`[AE2:ContractValidator] Contract ${contractId} not found`);
      return false;
    }

    const contract = loadContract(targetPath);
    const result = validateSingleContract(contract, mode);

    if (!result.valid) {
      console.error(
        `[AE2:ContractValidator] Contract ${contractId} validation failed:`,
        result.errors
      );
      return false;
    }

    console.log(`[AE2:ContractValidator] ✓ Contract ${contractId} valid`);
    return true;
  } catch (error) {
    console.error(
      `[AE2:ContractValidator] Error validating contract ${contractId}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Limpa o cache de contratos (útil para testes)
 */
export function clearContractCache(): void {
  contractCache.clear();
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE2:ContractValidator] Testing Contract Validator...\n");

  async function runTests() {
    // Teste 1: Validar todos os contratos (modo fullstack)
    console.log("=== Teste 1: Validar Todos os Contratos (Fullstack) ===");
    const result1 = await validateContracts("fullstack");
    console.log("Resultado:", result1 ? "✓ PASS" : "✗ FAIL");

    // Teste 2: Validar todos os contratos (modo lite)
    console.log("\n=== Teste 2: Validar Todos os Contratos (Lite) ===");
    const result2 = await validateContracts("lite");
    console.log("Resultado:", result2 ? "✓ PASS" : "✗ FAIL");

    // Teste 3: Validar contrato específico
    console.log("\n=== Teste 3: Validar Contrato Específico (m1-m2) ===");
    const result3 = await validateContractById("m1_m2", "fullstack");
    console.log("Resultado:", result3 ? "✓ PASS" : "✗ FAIL");

    // Teste 4: Validar contrato inexistente
    console.log("\n=== Teste 4: Validar Contrato Inexistente ===");
    const result4 = await validateContractById("m99_m99", "fullstack");
    console.log("Resultado:", result4 ? "✓ UNEXPECTED PASS" : "✗ EXPECTED FAIL");

    console.log("\n[AE2:ContractValidator] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
