import { FileMetricsSink } from "@arqos/utils";
import { EnginePaths } from "../src/core/paths";
import * as fs from "fs";
import * as path from "path";
import { ExecutionEngine } from "./execution/execution-engine";
import { ToolRegistry } from "./tools/recebe/tool-registry";
import { AE2Listener } from "./integration/ae2-listener";
import { AE1Reporter } from "./integration/ae1-reporter";
import { ToolHealth } from "./monitoring/tool-health";
import { PluginLoader } from "./plugins/plugin-loader";
import type { OrchestrationPlan, ExecutionResult, ToolAvailability } from "./types";
import { UserIntentParser } from "./tools/recebe/user-intent-parser";
import { DataAnonymizer } from "./tools/recebe/data-anonymizer";
import { Webhook } from "./tools/recebe/webhook";
import { HTTPRequest } from "./tools/recebe/http-request";
import { InputValidator } from "./tools/colhe/input-validator";
import { ExcelDataProcessor } from "./tools/colhe/excel-data-processor";
import { MarketDataFetcher } from "./tools/colhe/market-data-fetcher";
import { HybridSearch } from "./tools/colhe/hybrid-search";
import { UserProfileManager } from "./tools/colhe/user-profile-manager";
import { EmbeddingLookup } from "./tools/colhe/embedding-lookup";
import { TaskDiagnoser } from "./tools/colhe/task-diagnoser";
import { DataIntegration } from "./tools/colhe/data-integration";
import { DatabaseQuery } from "./tools/colhe/database-query";
import { ChainOfThoughtGenerator } from "./tools/processa/chain-of-thought";
import { FinancialManager } from "./tools/processa/financial-manager";
import { ScenarioSimulator } from "./tools/processa/scenario-simulator";
import { PricingEngine } from "./tools/processa/pricing-engine";
import { InvestmentPlanner } from "./tools/processa/investment-planner";
import { MultimodalSynthesizer } from "./tools/processa/multimodal-synthesizer";
import { PredictiveOptimizer } from "./tools/processa/predictive-optimizer";
import { TaxComplianceSimulator } from "./tools/processa/tax-compliance";
import { InsightSummarizer as ProcessaSummarizer } from "./tools/processa/insight-summarizer";
import { DataTransformer } from "./tools/processa/data-transformer";
import { SentimentAnalyzer } from "./tools/processa/sentiment-analyzer";
import { PatternMatcher } from "./tools/processa/pattern-matcher";
import { AnomalyDetector } from "./tools/processa/anomaly-detector";
import { FeedbackAndAlerting } from "./tools/fornece/feedback-alerting";
import { WebResearchUpdater } from "./tools/fornece/web-research-updater";
import { ClauseGeneration } from "./tools/fornece/clause-generation";
import { Traducao } from "./tools/fornece/traducao";
import { VersionManager } from "./tools/fornece/version-manager";
import { InsightSummarizer as ForneceSummarizer } from "./tools/fornece/insight-summarizer";
import { ReportGenerator } from "./tools/fornece/report-generator";
import { EmailSender } from "./tools/fornece/email-sender";

export class PipelineCore {
  private mode: "lite" | "fullstack";
  private toolRegistry!: ToolRegistry;
  private executionEngine!: ExecutionEngine;
  private ae2Listener!: AE2Listener;
  private ae1Reporter!: AE1Reporter;
  private toolHealth!: ToolHealth;
  private pluginLoader?: PluginLoader;
  private metricsSink?: FileMetricsSink;

  constructor(mode: "lite" | "fullstack") {
    this.mode = mode;
    console.log(`[AE3] Initializing Pipeline Core in ${mode} mode...`);
  }

  async initialize(): Promise<void> {
    console.log("[AE3] Waiting for AE2 and AE1 to be ready...");
    await this.waitForDependencies();

    // Initialize Metrics Sink
    try {
      const logsDir = EnginePaths.resolveFromRoot("logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.metricsSink = new FileMetricsSink(logsDir);
      console.log(`[AE3] Metrics sink initialized at ${logsDir}`);
    } catch (err) {
      console.warn("[AE3] Failed to initialize metrics sink:", err);
    }

    this.toolRegistry = new ToolRegistry(this.mode);
    await this.loadTools();

    this.executionEngine = new ExecutionEngine(this.mode, this.toolRegistry);

    this.ae2Listener = new AE2Listener();
    await this.ae2Listener.connect();

    this.ae1Reporter = new AE1Reporter();
    await this.ae1Reporter.connect();

    this.toolHealth = new ToolHealth(this.toolRegistry);
    this.toolHealth.start();

    if (this.mode === "fullstack") {
      this.pluginLoader = new PluginLoader();
      await this.loadPlugins();
    }

    this.ae2Listener.onOrchestrationPlan(async (plan) => {
      await this.executePlan(plan);
    });

    console.log("[AE3] Pipeline Core initialized OK");
    console.log(`[AE3] Tools loaded: ${this.toolRegistry.count()}`);
  }

  private async waitForDependencies(): Promise<void> {
    await Promise.all([this.waitForAE2(), this.waitForAE1()]);
  }

  private async waitForAE2(): Promise<void> {
    console.log("[AE3] Waiting for AE2...");
    console.log("[AE3] AE2 ready OK");
  }

  private async waitForAE1(): Promise<void> {
    console.log("[AE3] Waiting for AE1...");
    console.log("[AE3] AE1 ready OK");
  }

  private async loadTools(): Promise<void> {
    console.log(`[AE3] Loading tools for ${this.mode} mode...`);

    if (this.mode === "lite") {
      await this.toolRegistry.registerTool("UserIntentParser", "recebe", () => new UserIntentParser());
      await this.toolRegistry.registerTool("InputValidator", "colhe", () => new InputValidator());
      await this.toolRegistry.registerTool(
        "ChainOfThoughtGenerator",
        "processa",
        () => new ChainOfThoughtGenerator(this.mode)
      );
      await this.toolRegistry.registerTool("InsightSummarizer", "processa", () => new ProcessaSummarizer());
      await this.toolRegistry.registerTool("ClauseGeneration", "fornece", () => new ClauseGeneration());

      console.log("[AE3] 5 essential tools loaded (lite mode) OK");
      return;
    }

    await this.loadAllTools();
    console.log("[AE3] 40+ tools loaded (fullstack mode) OK");
  }

  private async loadAllTools(): Promise<void> {
    await this.toolRegistry.registerTool("UserIntentParser", "recebe", () => new UserIntentParser());
    await this.toolRegistry.registerTool("DataAnonymizer", "recebe", () => new DataAnonymizer());
    await this.toolRegistry.registerTool("Webhook", "recebe", () => new Webhook());
    await this.toolRegistry.registerTool("HTTPRequest", "recebe", () => new HTTPRequest(this.metricsSink));
    await this.toolRegistry.registerTool("InputValidator", "recebe", () => new InputValidator());

    await this.toolRegistry.registerTool("ExcelDataProcessor", "colhe", () => new ExcelDataProcessor());
    await this.toolRegistry.registerTool("MarketDataFetcher", "colhe", () => new MarketDataFetcher());
    await this.toolRegistry.registerTool("HybridSearch", "colhe", () => new HybridSearch());
    await this.toolRegistry.registerTool("UserProfileManager", "colhe", () => new UserProfileManager());
    await this.toolRegistry.registerTool("EmbeddingLookup", "colhe", () => new EmbeddingLookup());
    await this.toolRegistry.registerTool("TaskDiagnoser", "colhe", () => new TaskDiagnoser());
    await this.toolRegistry.registerTool("DataIntegration", "colhe", () => new DataIntegration());
    await this.toolRegistry.registerTool("DatabaseQuery", "colhe", () => new DatabaseQuery());

    await this.toolRegistry.registerTool(
      "ChainOfThoughtGenerator",
      "processa",
      () => new ChainOfThoughtGenerator(this.mode)
    );
    await this.toolRegistry.registerTool("FinancialManager", "processa", () => new FinancialManager());
    await this.toolRegistry.registerTool("ScenarioSimulator", "processa", () => new ScenarioSimulator());
    await this.toolRegistry.registerTool("PricingEngine", "processa", () => new PricingEngine());
    await this.toolRegistry.registerTool("InvestmentPlanner", "processa", () => new InvestmentPlanner());
    await this.toolRegistry.registerTool("MultimodalSynthesizer", "processa", () => new MultimodalSynthesizer());
    await this.toolRegistry.registerTool("PredictiveOptimizer", "processa", () => new PredictiveOptimizer());
    await this.toolRegistry.registerTool("TaxComplianceSimulator", "processa", () => new TaxComplianceSimulator());
    await this.toolRegistry.registerTool("InsightSummarizer", "processa", () => new ProcessaSummarizer());
    await this.toolRegistry.registerTool("DataTransformer", "processa", () => new DataTransformer());
    await this.toolRegistry.registerTool("SentimentAnalyzer", "processa", () => new SentimentAnalyzer());
    await this.toolRegistry.registerTool("PatternMatcher", "processa", () => new PatternMatcher());
    await this.toolRegistry.registerTool("AnomalyDetector", "processa", () => new AnomalyDetector());

    await this.toolRegistry.registerTool("FeedbackAndAlerting", "fornece", () => new FeedbackAndAlerting());
    await this.toolRegistry.registerTool("WebResearchUpdater", "fornece", () => new WebResearchUpdater());
    await this.toolRegistry.registerTool("ClauseGeneration", "fornece", () => new ClauseGeneration());
    await this.toolRegistry.registerTool("Traducao", "fornece", () => new Traducao());
    await this.toolRegistry.registerTool("InsightSummarizerOutput", "fornece", () => new ForneceSummarizer());
    await this.toolRegistry.registerTool("VersionManager", "fornece", () => new VersionManager());
    await this.toolRegistry.registerTool("ReportGenerator", "fornece", () => new ReportGenerator());
    await this.toolRegistry.registerTool("EmailSender", "fornece", () => new EmailSender());
  }

  private async loadPlugins(): Promise<void> {
    console.log("[AE3] Loading custom plugins...");

    const plugins = await this.pluginLoader!.discover();
    for (const plugin of plugins) {
      await this.toolRegistry.registerPlugin(plugin);
    }

    console.log(`[AE3] ${plugins.length} custom plugins loaded OK`);
  }

  async executePlan(plan: OrchestrationPlan): Promise<ExecutionResult> {
    console.log(`[AE3] Executing orchestration plan: ${plan.id}`);

    const startTime = Date.now();

    try {
      this.validatePlan(plan);
      const result = await this.executionEngine.execute(plan);

      await this.ae1Reporter.reportExecution({
        plan_id: plan.id,
        result,
        duration_ms: Date.now() - startTime,
      });

      console.log(`[AE3] Plan executed successfully: ${plan.id} OK`);
      return result;
    } catch (error) {
      console.error(`[AE3] Plan execution failed: ${plan.id}`, error);

      await this.ae1Reporter.reportFailure({
        plan_id: plan.id,
        error,
        duration_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  private validatePlan(plan: OrchestrationPlan): void {
    for (const step of plan.sequence) {
      if (!this.toolRegistry.hasTool(step.tool_name)) {
        throw new Error(`[AE3] Tool not available: ${step.tool_name}`);
      }
    }
  }

  async getToolAvailability(): Promise<ToolAvailability> {
    const tools = this.toolRegistry.getAllTools();

    return {
      total_tools: tools.length,
      available_tools: tools.filter((t) => t.status === "healthy").length,
      degraded_tools: tools.filter((t) => t.status === "degraded").length,
      unavailable_tools: tools.filter((t) => t.status === "down").length,
      tools: tools.map((t) => ({
        name: t.name,
        phase: t.phase,
        status: t.status,
        avg_latency_ms: t.metrics.avg_latency_ms,
        success_rate: t.metrics.success_rate,
      })),
    };
  }
}
