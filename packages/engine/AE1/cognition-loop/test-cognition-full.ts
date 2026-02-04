import { CognitionLoop } from "./loop-orchestrator";
import { MemoryManager } from "../memory/memory-manager";
import { InMemoryStore } from "../state/in-memory-store";
import { LearningEngine } from "../learning/learning-engine";
import { PatternDetector } from "../pattern-detection/pattern-detector";
import { HeuristicManager } from "../heuristics/heuristic-manager";

async function runFullstackTest() {
    console.log("--- Starting AE1 Cognition Loop Fullstack Test ---");
    const stateStore = new InMemoryStore();
    const memory = new MemoryManager("fullstack", stateStore);
    const patternDetector = new PatternDetector("fullstack");
    const heuristicManager = new HeuristicManager("fullstack");

    const cognition = new CognitionLoop(
        memory,
        patternDetector,
        heuristicManager,
        "fullstack"
    );

    console.log("1. Simulating baseline events (Fast)...");
    for (let i = 0; i < 50; i++) {
        await memory.store({
            id: `base_${i}`,
            timestamp: new Date().toISOString(),
            type: "data_fetch",
            outcome: "success",
            duration_ms: 200 + Math.random() * 50
        });
    }

    console.log("2. Simulating an anomaly (Latent Burst)...");
    for (let i = 0; i < 5; i++) {
        await memory.store({
            id: `spike_${i}`,
            timestamp: new Date().toISOString(),
            type: "data_fetch",
            outcome: "success",
            duration_ms: 1500 // > P99/Z-Score trigger
        });
    }

    console.log("3. Executing Cognition Cycle...");
    await cognition.trigger();

    console.log("4. Verifying Patterns and Suggestions...");
    const suggestions = await heuristicManager.getSuggestions();
    console.log("Heuristic Suggestions Count:", suggestions.length);

    const latestHeuristic = suggestions[suggestions.length - 1];
    if (latestHeuristic) {
        console.log(`Action: ${latestHeuristic.suggested_action} (Confidence: ${latestHeuristic.confidence})`);
    }

    console.log("5. Verifying Persistence...");
    const reflections = await memory.retrieve({ type: "semantic", text: "cognition_reflections", limit: 1 });
    if (reflections.length > 0) {
        console.log("✅ Reflections persisted in Memory Store.");
    } else {
        console.error("❌ Reflections persistence failed.");
    }

    const patterns = await memory.retrieve({ type: "semantic", text: "cognition_patterns", limit: 1 });
    if (patterns.length > 0) {
        console.log("✅ Patterns persisted in Memory Store.");
    } else {
        console.error("❌ Patterns persistence failed.");
    }

    console.log("--- AE1 Cognition Loop Fullstack Test Finished ---");
}

runFullstackTest().catch(console.error);
