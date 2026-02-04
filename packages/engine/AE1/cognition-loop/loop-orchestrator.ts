import type { MemoryManager } from "../memory/memory-manager";
import type { PatternDetector } from "../pattern-detection/pattern-detector";
import type { HeuristicManager } from "../heuristics/heuristic-manager";
import type { Observation, Reflection, Pattern, HeuristicSuggestion } from "./loop-types";
import { observeEvents } from "./observe";
import { reflectOnObservations } from "./reflect";
import { abstractPatterns } from "./abstract";
import { suggestHeuristics } from "./suggest";

export class CognitionLoop {
  private isRunning = false;

  constructor(
    private memory: MemoryManager,
    private patternDetector: PatternDetector,
    private heuristicManager: HeuristicManager,
    private mode: "lite" | "fullstack"
  ) { }

  start(): void {
    if (this.mode === "lite") {
      console.log("[AE1] Cognition loop in on-demand mode (lite)");
      return;
    }

    this.isRunning = true;
    console.log("[AE1] Cognition loop started (continuous)");

    setInterval(() => {
      void this.executeCycle();
    }, 60000);
  }

  async trigger(): Promise<void> {
    await this.executeCycle();
  }

  private iterationCount = 0;
  private readonly MAX_COGNITION_RECURSION = 5;

  private async executeCycle(): Promise<void> {
    if (!this.isRunning && this.mode === "fullstack") {
      return;
    }

    this.iterationCount++;
    if (this.iterationCount > this.MAX_COGNITION_RECURSION) {
      console.error("[AE1] CognitionLoop: Max recursion depth reached. Safety halt.");
      this.iterationCount = 0; // Reset for next scheduled run
      return;
    }

    console.log(`[AE1] Executing cognition cycle (iteration ${this.iterationCount})...`);

    try {
      const observations = await this.observe();
      const reflections = await this.reflect(observations);

      // Run pattern detection in both modes (Lite uses statistical only)
      const patterns = await this.abstract(reflections, observations);

      if (patterns.length > 0) {
        const suggestions = await this.suggest(patterns);
        await this.heuristicManager.storeSuggestions(suggestions);

        // Persist findings in state store
        await this.memory.store({
          id: `patterns_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "cognition_patterns",
          outcome: "detected",
          metadata: { patterns }
        });
      }

      // Persist reflections
      if (reflections.length > 0) {
        await this.memory.store({
          id: `reflections_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "cognition_reflections",
          outcome: "analyzed",
          metadata: { reflections }
        });
      }

      console.log("[AE1] Cognition cycle complete ✓");
    } catch (error) {
      console.error("[AE1] Cognition cycle failed:", error);
    }
  }

  private async observe(): Promise<Observation[]> {
    const recentEvents = await this.memory.retrieve({
      timeframe: "recent",
      limit: 100,
    });

    const observations = observeEvents(recentEvents);

    // Enrich with semantic context from Vectorial Memory
    for (const obs of observations) {
      if (obs.type.includes("error") || obs.duration_ms > 1000) {
        try {
          const context = await this.memory.retrieve({
            type: "semantic",
            text: `${obs.type} ${obs.outcome || ""}`,
            limit: 3
          });

          if (context.length > 0) {
            obs.metadata = {
              ...obs.metadata,
              similar_past_events: context.map(e => ({ id: e.id, outcome: e.outcome }))
            };
          }
        } catch (e) {
          // Ignore retrieval errors to not block loop
        }
      }
    }

    return observations;
  }

  private async reflect(observations: Observation[]): Promise<Reflection[]> {
    return reflectOnObservations(observations);
  }

  private async abstract(reflections: Reflection[], observations: Observation[]): Promise<Pattern[]> {
    const detected = await this.patternDetector.detectPatterns(reflections, observations);
    if (detected.length > 0) {
      return detected;
    }
    return abstractPatterns(reflections);
  }

  private async suggest(patterns: Pattern[]): Promise<HeuristicSuggestion[]> {
    return suggestHeuristics(patterns);
  }
}
