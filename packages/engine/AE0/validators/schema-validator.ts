import Ajv, { ValidateFunction } from 'ajv';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';
import { EnginePaths } from '../../src/core/paths';
import { ArqosError } from '@arqos/utils';

/**
 * Schema Validator para AE0
 * Valida arquivos YAML contra JSON Schemas usando AJV
 */

interface ValidationResult {
  filePath: string;
  schemaId: string;
  valid: boolean;
  errors?: string[];
}

interface SchemaMapping {
  yamlPattern: RegExp;
  schemaFile: string;
  description: string;
}

// Mapeamento de arquivos YAML para seus respectivos schemas
const SCHEMA_MAPPINGS: SchemaMapping[] = [
  {
    yamlPattern: /ae0\.yaml$/,
    schemaFile: 'ae0.schema.json',
    description: 'AE0 Harbor Bootstrap configuration'
  },
  {
    yamlPattern: /ae1\.yaml$/,
    schemaFile: 'ae1.schema.json',
    description: 'AE1 DNABase configuration'
  },
  {
    yamlPattern: /ae2\.yaml$/,
    schemaFile: 'ae2.schema.json',
    description: 'AE2 Strategos configuration'
  },
  {
    yamlPattern: /ae3\.yaml$/,
    schemaFile: 'ae3.schema.json',
    description: 'AE3 Pipeline configuration'
  },
  {
    yamlPattern: /tool-config.*\.yaml$/,
    schemaFile: 'tool-config.schema.json',
    description: 'Tool configuration'
  },
  {
    yamlPattern: /execution-plan.*\.yaml$/,
    schemaFile: 'execution-plan.schema.json',
    description: 'Execution plan'
  },
  {
    yamlPattern: /execution-result.*\.yaml$/,
    schemaFile: 'execution-result.schema.json',
    description: 'Execution result'
  },
  {
    yamlPattern: /[\\\/]AE3[\\\/]contracts[\\\/]tools[\\\/].*\.contract\.ya?ml$/i,
    schemaFile: 'tool-contract.schema.json',
    description: 'AE3 Tool contract'
  }
];

/**
 * Carrega todos os schemas JSON do diretório de schemas
 */
async function loadSchemas(schemasPath: string): Promise<Map<string, object>> {
  const schemas = new Map<string, object>();

  try {
    const files = await fs.readdir(schemasPath);

    for (const file of files) {
      if (file.endsWith('.schema.json')) {
        const filePath = path.join(schemasPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const schema = JSON.parse(content);
        schemas.set(file, schema);
      }
    }

    return schemas;
  } catch (error) {
    throw new Error(`Erro ao carregar schemas de ${schemasPath}: ${error}`);
  }
}

/**
 * Encontra arquivos YAML recursivamente a partir de um diretório
 */
async function findYamlFiles(dirPath: string): Promise<string[]> {
  const yamlFiles: string[] = [];

  async function scan(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Pular diretórios node_modules, .git, etc
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
          yamlFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Ignora erros de permissão em diretórios específicos
      console.warn(`Aviso: não foi possível ler diretório ${dir}`);
    }
  }

  await scan(dirPath);
  return yamlFiles;
}

/**
 * Determina qual schema usar para um arquivo YAML
 */
function getSchemaForYaml(yamlPath: string): SchemaMapping | null {
  const fileName = path.basename(yamlPath);

  for (const mapping of SCHEMA_MAPPINGS) {
    if (mapping.yamlPattern.test(yamlPath) || mapping.yamlPattern.test(fileName)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Valida um arquivo YAML contra um schema
 */
async function validateYamlFile(
  yamlPath: string,
  schemaMapping: SchemaMapping,
  schemas: Map<string, object>,
  ajv: Ajv
): Promise<ValidationResult> {
  const result: ValidationResult = {
    filePath: yamlPath,
    schemaId: schemaMapping.schemaFile,
    valid: false,
    errors: []
  };

  try {
    // Ler arquivo YAML
    const yamlContent = await fs.readFile(yamlPath, 'utf-8');
    const yamlData = YAML.parse(yamlContent);

    // Obter schema
    const schema = schemas.get(schemaMapping.schemaFile);
    if (!schema) {
      result.errors = [`Schema ${schemaMapping.schemaFile} não encontrado`];
      return result;
    }

    // Compilar e validar
    let validate: ValidateFunction;
    try {
      validate = ajv.compile(schema);
    } catch (compileError) {
      result.errors = [`Erro ao compilar schema: ${compileError}`];
      return result;
    }

    const valid = validate(yamlData);
    result.valid = valid;

    if (!valid && validate.errors) {
      result.errors = validate.errors.map(err => {
        const field = err.instancePath || 'root';
        return `${field}: ${err.message}`;
      });
    }

    return result;
  } catch (error) {
    result.errors = [`Erro ao processar arquivo: ${error}`];
    return result;
  }
}

/**
 * Valida todos os schemas do projeto
 *
 * @param schemasPath - Caminho para o diretório de schemas JSON
 * @param projectRoot - Raiz do projeto (opcional, usa process.cwd() por padrão)
 * @param verbose - Exibir logs detalhados
 * @throws Error se houver falhas críticas de validação
 */
export async function validateSchemas(
  schemasPath: string,
  projectRoot?: string,
  verbose: boolean = false
): Promise<void> {
  if (!schemasPath) {
    throw new Error("schemasPath is required");
  }

  const root = projectRoot || process.cwd();

  console.log(`[AE0] Iniciando validação de schemas...`);
  console.log(`[AE0] Schemas path: ${schemasPath}`);
  console.log(`[AE0] Project root: ${root}`);

  // Carregar todos os schemas
  const schemas = await loadSchemas(schemasPath);
  console.log(`[AE0] ✓ ${schemas.size} schemas carregados`);

  // Configurar AJV
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: true
  });

  // Encontrar arquivos YAML
  const yamlFiles = await findYamlFiles(root);
  console.log(`[AE0] ✓ ${yamlFiles.length} arquivos YAML encontrados`);

  // Filtrar apenas arquivos que têm schema correspondente
  const filesToValidate: Array<{ file: string; mapping: SchemaMapping }> = [];
  for (const yamlFile of yamlFiles) {
    const mapping = getSchemaForYaml(yamlFile);
    if (mapping) {
      filesToValidate.push({ file: yamlFile, mapping });
    }
  }

  console.log(`[AE0] ✓ ${filesToValidate.length} arquivos para validar`);

  if (filesToValidate.length === 0) {
    console.warn(`[AE0] ⚠ Nenhum arquivo YAML para validar encontrado`);
    return;
  }

  // Validar cada arquivo
  const results: ValidationResult[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const { file, mapping } of filesToValidate) {
    const result = await validateYamlFile(file, mapping, schemas, ajv);
    results.push(result);

    if (result.valid) {
      validCount++;
      if (verbose) {
        console.log(`[AE0] ✓ ${path.relative(root, file)} (${mapping.description})`);
      }
    } else {
      invalidCount++;
      console.error(`[AE0] ✗ ${path.relative(root, file)} (${mapping.description})`);
      if (result.errors) {
        result.errors.forEach(err => console.error(`  - ${err}`));
      }
    }
  }

  // Resumo
  console.log(`\n[AE0] Validação de Schemas - Resumo:`);
  console.log(`  Total: ${results.length}`);
  console.log(`  Válidos: ${validCount}`);
  console.log(`  Inválidos: ${invalidCount}`);

  // Throw se houver erros
  if (invalidCount > 0) {
    throw new Error(
      `Validação de schemas falhou: ${invalidCount} arquivo(s) inválido(s)`
    );
  }

  console.log(`[AE0] ✓ Todos os schemas validados com sucesso\n`);
}

/**
 * Valida um único arquivo YAML
 * Útil para validação sob demanda
 */
export async function validateSingleSchema(
  yamlPath: string,
  schemasPath: string
): Promise<{ valid: boolean; errors?: string[] }> {
  const mapping = getSchemaForYaml(yamlPath);
  if (!mapping) {
    return {
      valid: false,
      errors: [`Nenhum schema encontrado para arquivo ${path.basename(yamlPath)}`]
    };
  }

  const schemas = await loadSchemas(schemasPath);
  const ajv = new Ajv({ allErrors: true, strict: false });

  const result = await validateYamlFile(yamlPath, mapping, schemas, ajv);

  return {
    valid: result.valid,
    errors: result.errors
  };
}

// CLI execution
if (require.main === module) {
  const schemasPath = EnginePaths.getSchemasPath();
  const projectRoot = EnginePaths.getRoot();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  validateSchemas(schemasPath, projectRoot, verbose)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(`\n[AE0] ✗ Erro fatal: ${error.message}`);
      process.exit(1);
    });
}
