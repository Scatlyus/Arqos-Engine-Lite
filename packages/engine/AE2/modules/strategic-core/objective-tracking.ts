import type { DecisionContext } from "../../types";

type ObjectiveTracking = {
  objectives: string[];
  constraints: unknown[];
};

export function trackObjectives(context: DecisionContext): ObjectiveTracking {
  const intent = (context.intent || "").trim();
  const objectives = intent ? [intent] : ["define_primary_goal"];
  const constraints = context.constraints || [];

  return {
    objectives,
    constraints,
  };
}
