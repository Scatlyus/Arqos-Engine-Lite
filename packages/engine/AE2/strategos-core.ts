import { ModuleCoordinator } from "./modules/module-coordinator";
import { StrategicCore } from "./modules/strategic-core/strategic-core";
import { InternalOrchestrator } from "./modules/internal-orchestrator/orchestrator";
import { DecisionAuditor } from "./modules/decision-auditor/auditor";
import { DistributedExecutionManager } from "./modules/distributed-execution/execution-manager";
import { ContextualAwareness } from "./modules/contextual-awareness/context-analyzer";
import { PredictiveOptimization } from "./modules/predictive-optimization/optimizer";
import { SelfReflection } from "./modules/self-reflection/reflector";
import { EvolutionManager } from "./modules/evolution-manager/evolution";
import { DecisionEngine } from "./decision-engine/decision-maker";
import { OrchestrationPlanner } from "./orchestration/orchestration-planner";
import { AE1Client } from "./integration/ae1-client";
import { AE3Client } from "./integration/ae3-client";
import { validateContractById } from "./contracts/contract-validator";
import type {
  DecisionContext,
  StrategicDecision,
  OrchestrationRequest,
  OrchestrationPlan,
  ReflectionReport,
  ExecutionOutcome,
  Module,
} from "./types";

export class StrategosCore {
  private mode: "lite" | "fullstack";
  private moduleCoordinator!: ModuleCoordinator;

  private strategicCore!: StrategicCore;
  private internalOrchestrator!: InternalOrchestrator;
  private decisionAuditor!: DecisionAuditor;

  private distributedExecution?: DistributedExecutionManager;
  private contextualAwareness?: ContextualAwareness;
  private predictiveOptimization?: PredictiveOptimization;
  private selfReflection?: SelfReflection;
  private evolutionManager?: EvolutionManager;

  private decisionEngine!: DecisionEngine;
  private orchestrationPlanner!: OrchestrationPlanner;

  private ae1Client?: AE1Client;
  private ae3Client!: AE3Client;

  constructor(mode: "lite" | "fullstack") {
    this.mode = mode;
    console.log(`[AE2] Initializing Strategos Core in ${mode} mode...`);
  }

  async initialize(): Promise<void> {
    console.log("[AE2] Starting initialization (first component to unlock)...");

    await this.initializeCoreModules();

    if (this.mode === "fullstack") {
      await this.initializeFullstackModules();
      await this.validateCognitiveContracts();
    }

    this.decisionEngine = new DecisionEngine({ mode: this.mode });
    this.orchestrationPlanner = new OrchestrationPlanner(this.mode);
    this.ae3Client = new AE3Client();

    if (this.mode === "fullstack") {
      this.ae1Client = new AE1Client();
    }

    this.moduleCoordinator = new ModuleCoordinator(this.getAllActiveModules(), this.mode);

    console.log("[AE2] Strategos Core initialized ✓");
    console.log(`[AE2] Active modules: ${this.getActiveModuleCount()}`);
  }

  private async initializeCoreModules(): Promise<void> {
    console.log("[AE2] Initializing core modules (3)...");

    this.strategicCore = new StrategicCore();
    await this.strategicCore.initialize();

    this.internalOrchestrator = new InternalOrchestrator();
    await this.internalOrchestrator.initialize();

    this.decisionAuditor = new DecisionAuditor();
    await this.decisionAuditor.initialize();

    console.log("[AE2] Core modules initialized ✓");
  }

  private async initializeFullstackModules(): Promise<void> {
    console.log("[AE2] Initializing fullstack modules (5 additional)...");

    this.distributedExecution = new DistributedExecutionManager();
    await this.distributedExecution.initialize();

    this.contextualAwareness = new ContextualAwareness();
    await this.contextualAwareness.initialize();

    this.predictiveOptimization = new PredictiveOptimization();
    await this.predictiveOptimization.initialize();

    this.selfReflection = new SelfReflection();
    await this.selfReflection.initialize();

    this.evolutionManager = new EvolutionManager();
    await this.evolutionManager.initialize();

    console.log("[AE2] Fullstack modules initialized ✓");
  }

  private async validateCognitiveContracts(): Promise<void> {
    console.log("[AE2] Validating cognitive contracts (8)...");

    const contracts = [
      "m1-m2",
      "m2-m3",
      "m2-m4",
      "m1-m5",
      "m1-m6",
      "m2-m7",
      "m1-m8",
      "m3-m8",
    ];

    for (const contract of contracts) {
      const valid = await this.validateContract(contract);
      if (!valid) {
        throw new Error(`[AE2] Cognitive contract ${contract} validation failed`);
      }
    }

    console.log("[AE2] All cognitive contracts validated ✓");
  }

  private getAllActiveModules(): Module[] {
    const modules: Module[] = [this.strategicCore, this.internalOrchestrator, this.decisionAuditor];

    if (this.mode === "fullstack") {
      modules.push(
        this.distributedExecution!,
        this.contextualAwareness!,
        this.predictiveOptimization!,
        this.selfReflection!,
        this.evolutionManager!
      );
    }

    return modules;
  }

  private getActiveModuleCount(): number {
    return this.mode === "lite" ? 3 : 8;
  }

  async makeDecision(context: DecisionContext): Promise<StrategicDecision> {
    console.log("[AE2] Making strategic decision via Engine...");

    // Delegate to DecisionEngine which handles analysis, context enrichment, and auditing
    const result = await this.decisionEngine.decide(context);

    console.log(`[AE2] Decision made: ${result.decision.id} ✓`);
    return result.decision;
  }

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationPlan> {
    console.log("[AE2] Creating orchestration plan via Engine...");

    const result = await this.decisionEngine.decide(
      request.context,
      request.agents,
      request.constraints
    );

    console.log(`[AE2] Orchestration plan created: ${result.plan.id} ✓`);
    return result.plan;
  }

  async reflect(): Promise<ReflectionReport | null> {
    if (this.mode === "lite") {
      console.log("[AE2] Self-reflection disabled in lite mode");
      return null;
    }

    console.log("[AE2] Performing self-reflection...");

    const report = await this.selfReflection!.reflect({
      recent_decisions: await this.decisionAuditor.getRecentDecisions(100),
      cognitive_context: await this.ae1Client!.getCognitiveContext(),
      execution_outcomes: await this.getExecutionOutcomes(),
    });

    console.log("[AE2] Self-reflection complete ✓");
    return report;
  }

  private async getExecutionOutcomes(): Promise<ExecutionOutcome[]> {
    return [];
  }

  private async validateContract(contractId: string): Promise<boolean> {
    return await validateContractById(contractId, this.mode);
  }
}
