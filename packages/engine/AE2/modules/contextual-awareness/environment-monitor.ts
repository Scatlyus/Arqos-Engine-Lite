type EnvironmentSnapshot = {
  timestamp: string;
  signals: string[];
};

export function monitorEnvironment(signals: string[]): EnvironmentSnapshot {
  return {
    timestamp: new Date().toISOString(),
    signals: signals.length ? signals : ["no_signals"]
  };
}
