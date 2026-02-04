import type { Module } from "../types";

export class ModuleCoordinator {
  constructor(private modules: Module[], private mode: "lite" | "fullstack") {}

  async initializeAll(): Promise<void> {
    for (const module of this.modules) {
      await module.initialize();
    }
  }
}
