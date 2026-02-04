import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type UserProfile = {
  user_id: string;
  attributes: Record<string, unknown>;
  segments: string[];
  history: Array<{ at: string; action: string; delta?: Record<string, unknown> }>;
  created_at: string;
  updated_at: string;
};

type ProfileAction = "get" | "upsert" | "merge" | "delete" | "list" | "segment";

type UserProfileOutput = {
  action: ProfileAction;
  profile?: UserProfile;
  profiles?: UserProfile[];
  status?: string;
};

export class UserProfileManager implements Tool {
  id = "T7";
  name = "UserProfileManager";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;
  private profiles: Map<string, UserProfile> = new Map();

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const action = this.normalizeAction(input.action);
      const userId = String(input.user_id ?? input.userId ?? "anonymous");
      const attributes = this.normalizeAttributes(input.attributes);

      let output: UserProfileOutput;
      switch (action) {
        case "list":
          output = { action, profiles: Array.from(this.profiles.values()) };
          break;
        case "delete":
          this.profiles.delete(userId);
          output = { action, status: "deleted" };
          break;
        case "segment":
          output = { action, profile: this.applySegmentation(userId) };
          break;
        case "merge":
          output = { action, profile: this.mergeAttributes(userId, attributes) };
          break;
        case "upsert":
          output = { action, profile: this.upsertProfile(userId, attributes) };
          break;
        case "get":
        default:
          output = { action, profile: this.getProfile(userId) };
          break;
      }

      this.successCount += 1;
      this.totalDuration += Date.now() - startTime;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output,
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "UserProfileManager failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 4;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private normalizeAction(value: unknown): ProfileAction {
    const action = String(value ?? "get").toLowerCase();
    if (action === "upsert" || action === "merge" || action === "delete" || action === "list" || action === "segment") {
      return action;
    }
    return "get";
  }

  private normalizeAttributes(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private getProfile(userId: string): UserProfile {
    const existing = this.profiles.get(userId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const profile: UserProfile = {
      user_id: userId,
      attributes: {},
      segments: [],
      history: [{ at: now, action: "created" }],
      created_at: now,
      updated_at: now
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  private upsertProfile(userId: string, attributes: Record<string, unknown>): UserProfile {
    const profile = this.getProfile(userId);
    profile.attributes = { ...profile.attributes, ...attributes };
    profile.updated_at = new Date().toISOString();
    profile.history.push({ at: profile.updated_at, action: "upsert", delta: attributes });
    this.profiles.set(userId, profile);
    return profile;
  }

  private mergeAttributes(userId: string, attributes: Record<string, unknown>): UserProfile {
    const profile = this.getProfile(userId);
    profile.attributes = this.deepMerge(profile.attributes, attributes);
    profile.updated_at = new Date().toISOString();
    profile.history.push({ at: profile.updated_at, action: "merge", delta: attributes });
    this.profiles.set(userId, profile);
    return profile;
  }

  private applySegmentation(userId: string): UserProfile {
    const profile = this.getProfile(userId);
    const segments = new Set(profile.segments);
    const spend = Number(profile.attributes.lifetime_value ?? profile.attributes.spend ?? 0);
    const sessions = Number(profile.attributes.sessions ?? 0);
    const churnRisk = Number(profile.attributes.churn_risk ?? 0);

    if (spend >= 10000) segments.add("high_value");
    if (spend > 0 && spend < 500) segments.add("low_value");
    if (sessions >= 10) segments.add("power_user");
    if (churnRisk >= 0.7) segments.add("at_risk");

    profile.segments = Array.from(segments);
    profile.updated_at = new Date().toISOString();
    profile.history.push({ at: profile.updated_at, action: "segment" });
    this.profiles.set(userId, profile);
    return profile;
  }

  private deepMerge(base: Record<string, unknown>, update: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(update)) {
      if (this.isPlainObject(value) && this.isPlainObject(result[key])) {
        result[key] = this.deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
}

if (require.main === module) {
  const tool = new UserProfileManager();
  console.log("[AE3:UserProfileManager] Testing UserProfileManager...\n");

  tool
    .execute({ action: "upsert", user_id: "u-1", attributes: { lifetime_value: 12000, sessions: 14 } })
    .then(() => tool.execute({ action: "segment", user_id: "u-1" }))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:UserProfileManager] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:UserProfileManager] Test failed", error);
    });
}
