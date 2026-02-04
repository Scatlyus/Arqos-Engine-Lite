import type { DecisionContext } from "../../types";

export function assessGoalAlignment(context: DecisionContext): number {
  const intent = (context.intent || "").trim();
  const constraints = context.constraints || [];

  let score = 0.5;

  if (intent.length > 0) {
    score += Math.min(0.3, intent.length / 100);
  }

  if (constraints.length > 0) {
    score -= Math.min(0.2, constraints.length * 0.05);
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
