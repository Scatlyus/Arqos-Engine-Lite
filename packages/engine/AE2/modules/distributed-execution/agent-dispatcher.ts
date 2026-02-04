type AgentCandidate = { id: string; load: number };
type DispatchResult = { assignments: Record<string, string[]> };

export function dispatchAgents(agents: AgentCandidate[], tasks: string[]): DispatchResult {
  if (!agents.length || !tasks.length) {
    return { assignments: {} };
  }

  const sortedAgents = [...agents].sort((a, b) => a.load - b.load);
  const assignments: Record<string, string[]> = {};

  let cursor = 0;
  for (const task of tasks) {
    const agent = sortedAgents[cursor % sortedAgents.length];
    assignments[agent.id] = assignments[agent.id] ?? [];
    assignments[agent.id].push(task);
    cursor += 1;
  }

  return { assignments };
}
