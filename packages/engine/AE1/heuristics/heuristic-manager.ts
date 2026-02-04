import type { HeuristicSuggestion } from "../cognition-loop/loop-types";
import { bumpHeuristicVersion, type ChangeImpact } from "./versioning";

interface StoredSuggestion extends HeuristicSuggestion {
  id: string;
  status: "pending" | "approved" | "rejected" | "applied";
  timestamp: string;
  appliedVersion?: string;
}

export class HeuristicManager {
  private currentVersion = "1.0.0";
  private suggestions: StoredSuggestion[] = [];

  constructor(private mode: "lite" | "fullstack") { }

  async storeSuggestions(newSuggestions: HeuristicSuggestion[]): Promise<void> {
    for (const suggestion of newSuggestions) {
      const impact = this.determineImpact(suggestion);

      // Lite mode constraints: Block major changes
      if (this.mode === "lite" && impact === "major") {
        console.warn(`[AE1] Major heuristic change blocked in Lite mode: ${suggestion.suggested_action}`);
        continue;
      }

      const stored: StoredSuggestion = {
        ...suggestion,
        id: `hs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        status: "pending",
        timestamp: new Date().toISOString()
      };

      // simple auto-approval logic for Lite mode or low confidence items
      // In Lite, we might just log them without applying if requires_review is true
      if (!suggestion.requires_review && impact !== "major") {
        await this.applySuggestion(stored, impact);
      } else {
        console.log(`[AE1] Suggestion stored for review: ${suggestion.suggested_action} (Impact: ${impact})`);
        this.suggestions.push(stored);
      }
    }
  }

  async getSuggestions(): Promise<StoredSuggestion[]> {
    return this.suggestions;
  }

  async getVersion(): Promise<string> {
    return this.currentVersion;
  }

  private async applySuggestion(suggestion: StoredSuggestion, impact: ChangeImpact): Promise<void> {
    console.log(`[AE1] Applying heuristic adjustment: ${suggestion.suggested_action}`);

    // 1. Update Version
    const oldVersion = this.currentVersion;
    this.currentVersion = bumpHeuristicVersion(this.currentVersion, impact);

    // 2. Update status
    suggestion.status = "applied";
    suggestion.appliedVersion = this.currentVersion;
    this.suggestions.push(suggestion); // Store history

    if (this.mode === "lite") {
      console.log(`[AE1] Heuristic version bumped: ${oldVersion} -> ${this.currentVersion}`);
    }
  }

  private determineImpact(suggestion: HeuristicSuggestion): ChangeImpact {
    if (suggestion.confidence > 0.8) return "major";
    if (suggestion.confidence > 0.4) return "minor";
    return "patch";
  }
}
