type LoadSnapshot = { id: string; load: number };

export function balanceLoad(agents: LoadSnapshot[]): LoadSnapshot[] {
  if (!agents.length) {
    return [];
  }

  const avgLoad = agents.reduce((acc, agent) => acc + agent.load, 0) / agents.length;
  return agents.map((agent) => ({
    ...agent,
    load: Number(((agent.load + avgLoad) / 2).toFixed(2))
  }));
}
