import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "yaml";

// ============================================================
// TYPES
// ============================================================

type DependencyCheck = {
  name: string;
  requiredPaths: string[];
};

interface DependencyNode {
  id: string;
  dependsOn: string[];
  version: string;
  contracts: {
    provides: string[];
    consumes: string[];
  };
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  order: string[];
}

interface ContractValidation {
  valid: boolean;
  errors: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_DEPENDENCIES: DependencyCheck[] = [
  {
    name: "AE1",
    requiredPaths: ["AE1", path.join("AE1", "ae1.yaml"), path.join("AE1", "cognitive-core.ts")]
  },
  {
    name: "AE2",
    requiredPaths: ["AE2", path.join("AE2", "ae2.yaml"), path.join("AE2", "strategos-core.ts")]
  },
  {
    name: "AE3",
    requiredPaths: ["AE3", path.join("AE3", "ae3.yaml"), path.join("AE3", "pipeline-core.ts")]
  }
];

const CANONICAL_UNLOCK_ORDER = ["AE2", "AE1", "AE3"];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadYaml(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return yaml.parse(content);
  } catch (error) {
    throw new Error(`[AE0] Falha ao carregar YAML ${filePath}: ${error}`);
  }
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`[AE0] Versão inválida: ${version}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  };
}

function isVersionCompatible(required: string, actual: string): boolean {
  const req = parseVersion(required);
  const act = parseVersion(actual);

  // Major version must match, minor/patch can be higher
  return req.major === act.major && act.minor >= req.minor;
}

// ============================================================
// DEPENDENCY GRAPH CONSTRUCTION
// ============================================================

async function buildDependencyGraph(projectRoot: string, mode: "lite" | "fullstack"): Promise<DependencyGraph> {
  const nodes = new Map<string, DependencyNode>();

  // Load AE1 config
  const ae1Config = await loadYaml(path.join(projectRoot, "AE1", "ae1.yaml"));
  nodes.set("AE1", {
    id: "AE1",
    dependsOn: ["AE0", "AE2"], // AE1 depends on AE2 for strategic context
    version: ae1Config.version || "2.1.0",
    contracts: {
      provides: ["cognitive_context", "pattern_insights", "learning_metrics"],
      consumes: ["strategic_directives", "learning_constraints"]
    }
  });

  // Load AE2 config
  const ae2Config = await loadYaml(path.join(projectRoot, "AE2", "ae2.yaml"));
  nodes.set("AE2", {
    id: "AE2",
    dependsOn: ["AE0"], // AE2 only depends on AE0
    version: ae2Config.version || "2.2.0",
    contracts: {
      provides: ["orchestration_plan", "strategic_directives", "learning_constraints"],
      consumes: ["cognitive_context", "execution_results"]
    }
  });

  // Load AE3 config
  const ae3Config = await loadYaml(path.join(projectRoot, "AE3", "ae3.yaml"));
  nodes.set("AE3", {
    id: "AE3",
    dependsOn: ["AE0", "AE2", "AE1"], // AE3 depends on both AE2 (orchestration) and AE1 (context)
    version: ae3Config.version || "2.1.0",
    contracts: {
      provides: ["execution_results", "tool_outputs"],
      consumes: ["orchestration_plan", "cognitive_context"]
    }
  });

  return {
    nodes,
    order: []
  };
}

// ============================================================
// CYCLE DETECTION (DFS)
// ============================================================

function detectCycles(graph: DependencyGraph): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    for (const depId of node.dependsOn) {
      if (depId === "AE0") continue; // Skip AE0 (bootstrap)

      if (!visited.has(depId)) {
        dfs(depId, [...path]);
      } else if (recursionStack.has(depId)) {
        // Cycle detected
        const cycleStart = path.indexOf(depId);
        const cycle = [...path.slice(cycleStart), depId].join(" → ");
        cycles.push(cycle);
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return cycles;
}

// ============================================================
// TOPOLOGICAL SORT (for unlock order)
// ============================================================

function topologicalSort(graph: DependencyGraph): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize
  for (const [nodeId, node] of graph.nodes) {
    inDegree.set(nodeId, 0);
    adjList.set(nodeId, []);
  }

  // Build adjacency list and in-degree count
  for (const [nodeId, node] of graph.nodes) {
    for (const depId of node.dependsOn) {
      if (depId === "AE0") continue; // Skip AE0

      if (adjList.has(depId)) {
        adjList.get(depId)!.push(nodeId);
        inDegree.set(nodeId, (inDegree.get(nodeId) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjList.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted;
}

// ============================================================
// CONTRACT VALIDATION
// ============================================================

async function validateContracts(projectRoot: string, graph: DependencyGraph): Promise<ContractValidation> {
  const errors: string[] = [];

  // Validate AE1-AE2 contract
  const ae1ae2ContractPath = path.join(projectRoot, "interfaces", "ae1-ae2.contract.yaml");
  if (await pathExists(ae1ae2ContractPath)) {
    const contract = await loadYaml(ae1ae2ContractPath);

    const ae1 = graph.nodes.get("AE1");
    const ae2 = graph.nodes.get("AE2");

    if (ae1 && ae2) {
      // Check if AE1 provides what contract specifies
      const contractProvides = contract.provides?.map((p: any) => p.name) || [];
      for (const provided of contractProvides) {
        if (!ae1.contracts.provides.includes(provided)) {
          errors.push(`AE1 não fornece '${provided}' conforme contrato ae1-ae2`);
        }
      }

      // Check if AE1 consumes what contract specifies
      const contractReceives = contract.receives?.map((r: any) => r.name) || [];
      for (const received of contractReceives) {
        if (!ae1.contracts.consumes.includes(received)) {
          errors.push(`AE1 não consome '${received}' conforme contrato ae1-ae2`);
        }
      }
    }
  } else {
    errors.push("Contrato ae1-ae2.contract.yaml não encontrado");
  }

  // Validate AE2-AE3 contract
  const ae2ae3ContractPath = path.join(projectRoot, "interfaces", "ae2-ae3.contract.yaml");
  if (await pathExists(ae2ae3ContractPath)) {
    const contract = await loadYaml(ae2ae3ContractPath);

    const ae2 = graph.nodes.get("AE2");
    const ae3 = graph.nodes.get("AE3");

    if (ae2 && ae3) {
      // Check if AE2 provides orchestration_plan
      const contractProvides = contract.provides?.map((p: any) => p.name) || [];
      for (const provided of contractProvides) {
        if (!ae2.contracts.provides.includes(provided)) {
          errors.push(`AE2 não fornece '${provided}' conforme contrato ae2-ae3`);
        }
      }
    }
  } else {
    errors.push("Contrato ae2-ae3.contract.yaml não encontrado");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================
// MAIN RESOLVER FUNCTION
// ============================================================

export async function resolveDependencies(
  projectRoot: string = process.cwd(),
  mode: "lite" | "fullstack" = "lite"
): Promise<void> {
  console.log(`[AE0] Resolvendo dependências (modo: ${mode})...`);

  // Step 1: Validate file existence
  const missing: string[] = [];
  for (const dependency of DEFAULT_DEPENDENCIES) {
    for (const relativePath of dependency.requiredPaths) {
      const absolutePath = path.join(projectRoot, relativePath);
      const exists = await pathExists(absolutePath);
      if (!exists) {
        missing.push(`${dependency.name}: ${relativePath}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`[AE0] Dependências ausentes: ${missing.join(", ")}`);
  }

  // Step 2: Build dependency graph
  const graph = await buildDependencyGraph(projectRoot, mode);

  // Step 3: Detect cycles
  const cycles = detectCycles(graph);
  if (cycles.length > 0) {
    throw new Error(`[AE0] Dependências circulares detectadas: ${cycles.join("; ")}`);
  }

  // Step 4: Compute topological order
  const computedOrder = topologicalSort(graph);
  graph.order = computedOrder;

  // Step 5: Validate unlock order
  if (JSON.stringify(computedOrder) !== JSON.stringify(CANONICAL_UNLOCK_ORDER)) {
    throw new Error(
      `[AE0] Ordem de unlock inválida. ` +
      `Esperado: ${CANONICAL_UNLOCK_ORDER.join("→")}, ` +
      `Calculado: ${computedOrder.join("→")}`
    );
  }

  // Step 6: Validate contracts
  const contractValidation = await validateContracts(projectRoot, graph);
  if (!contractValidation.valid) {
    console.warn(`[AE0] Avisos de contrato: ${contractValidation.errors.join("; ")}`);
    // Don't throw in lite mode, just warn
    if (mode === "fullstack") {
      throw new Error(`[AE0] Validação de contratos falhou: ${contractValidation.errors.join("; ")}`);
    }
  }

  // Step 7: Validate version compatibility (optional in lite mode)
  if (mode === "fullstack") {
    for (const [nodeId, node] of graph.nodes) {
      // Version validation logic here if needed
      console.log(`[AE0] ${nodeId} versão: ${node.version}`);
    }
  }

  console.log(`[AE0] ✅ Dependências resolvidas com sucesso`);
  console.log(`[AE0] ✅ Ordem de unlock validada: ${CANONICAL_UNLOCK_ORDER.join(" → ")}`);
  console.log(`[AE0] ✅ Contratos validados: ${contractValidation.valid ? "OK" : "AVISOS"}`);
}

// ============================================================
// EXPORT UTILITIES FOR TESTING
// ============================================================

export {
  buildDependencyGraph,
  detectCycles,
  topologicalSort,
  validateContracts,
  CANONICAL_UNLOCK_ORDER
};
