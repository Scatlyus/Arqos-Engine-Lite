import type { Reflection, Pattern } from "./loop-types";

export function abstractPatterns(reflections: Reflection[]): Pattern[] {
  const totals: Record<string, number> = {};
  const totalReflections = reflections.length || 1;

  for (const reflection of reflections) {
    for (const insight of reflection.insights) {
      totals[insight] = (totals[insight] ?? 0) + 1;
    }
  }

  return Object.entries(totals)
    .map(([insight, count], index) => ({
      id: `insight_${index}_${insight}`,
      type: "cluster" as const,
      description: `Frequent insight: ${insight} (${count} occurrences)`,
      confidence: Number((count / totalReflections).toFixed(2)),
      timestamp: new Date().toISOString()
    }))
    .filter((pattern) => pattern.confidence > 0);
}
