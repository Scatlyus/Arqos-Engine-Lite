import { bootstrap } from "./bootstrap";
import { MemoryManager } from "../AE1/memory/memory-manager";
import { DecisionEngine } from "../AE2/decision-engine/decision-maker";
import { PersistentStore } from "../AE1/state/persistent-store";
import { InMemoryStore } from "../AE1/state/in-memory-store";
import { StateStore } from "../AE1/state/state-store";

export interface ArqosConfig {
    mode: "lite" | "fullstack";
    persistence?: "local" | "memory" | "remote";
    storagePath?: string;
    enableAudit?: boolean;
}

/**
 * Arqos Engine - Universal Entry Point
 * High-level API for initializing and interacting with the engine.
 */
export class Arqos {
    private memory: MemoryManager;
    private decisionEngine: DecisionEngine;
    private state: StateStore;

    private constructor(
        private config: ArqosConfig,
        state: StateStore,
        memory: MemoryManager,
        decisionEngine: DecisionEngine
    ) {
        this.state = state;
        this.memory = memory;
        this.decisionEngine = decisionEngine;
    }

    /**
     * Initializes the Arqos Engine.
     * Uses provided configuration or falls back to environment variables.
     */
    public static async init(config: Partial<ArqosConfig> = {}): Promise<Arqos> {
        // Fallback to environment variables
        const mode = config.mode || (process.env.ARQOS_MODE as any) || "lite";
        const persistence = config.persistence || (process.env.ARQOS_PERSISTENCE as any) || "memory";
        const storagePath = config.storagePath || process.env.ARQOS_STORAGE_PATH || "./.storage";

        const finalConfig: ArqosConfig = {
            mode,
            persistence,
            storagePath,
            enableAudit: config.enableAudit ?? true
        };

        // 1. Setup State Storage
        let state: StateStore;
        if (finalConfig.persistence === "local") {
            state = new PersistentStore(finalConfig.storagePath);
        } else {
            state = new InMemoryStore();
        }

        // 2. Bootstrap Core Systems
        await bootstrap(mode);

        // 3. Initialize High-Level Modules
        const memory = new MemoryManager(mode, state);
        const decisionEngine = new DecisionEngine({
            mode,
            enableAudit: finalConfig.enableAudit ?? true,
        });

        await decisionEngine.initialize();

        console.log(`[Arqos] Engine initialized in ${mode} mode (persistence: ${persistence}) ✓`);

        return new Arqos(finalConfig, state, memory, decisionEngine);
    }

    public getMemory() {
        return this.memory;
    }

    public getDecisionEngine() {
        return this.decisionEngine;
    }

    public getState() {
        return this.state;
    }

    /**
     * Shorthand for making a strategic decision
     */
    public async decide(context: any, agents: any[] = [], constraints: any[] = []) {
        return this.decisionEngine.decide(context, agents, constraints);
    }
}
