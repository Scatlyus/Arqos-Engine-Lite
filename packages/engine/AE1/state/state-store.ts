export abstract class StateStore {
  abstract write(key: string, value: unknown): Promise<void>;
  abstract read<T>(key: string): Promise<T | null>;
}
