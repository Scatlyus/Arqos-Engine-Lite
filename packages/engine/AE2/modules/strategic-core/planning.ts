import type { DecisionContext } from "../../types";

export function buildPlan(context: DecisionContext): string[] {
  const steps: string[] = [];
  const intent = (context.intent || "").trim();
  const constraints = context.constraints || [];

  if (!intent) {
    steps.push("clarify_intent");
  } else {
    steps.push("confirm_intent");
  }

  if (constraints.length > 0) {
    steps.push("map_constraints");
  }

  steps.push("select_tools");
  steps.push("define_success_metrics");

  return steps;
}
