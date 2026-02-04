import { StateStore } from "./state-store";
import * as fs from "fs/promises";
import * as path from "path";

export class PersistentStore extends StateStore {
  private baseDir: string;

  constructor(storagePath?: string) {
    super();
    this.baseDir = storagePath || path.join(process.cwd(), ".arqos_data");
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }
  }

  async write(key: string, value: unknown): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.baseDir, `${this.sanitizeKey(key)}.json`);
    const data = JSON.stringify(value, null, 2);

    // Atomic write: write to tmp then rename
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, data, "utf8");
    await fs.rename(tmpPath, filePath);
  }

  async read<T>(key: string): Promise<T | null> {
    await this.ensureDir();
    const filePath = path.join(this.baseDir, `${this.sanitizeKey(key)}.json`);

    try {
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as T;
    } catch (err) {
      return null;
    }
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-z0-9_\-]/gi, "_");
  }
}
