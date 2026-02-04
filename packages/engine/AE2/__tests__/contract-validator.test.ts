/**
 * Testes Unitários: AE2 Contract Validator
 *
 * Exemplo de teste unitário usando Jest para validação de contratos cognitivos
 */

import { validateContracts, validateContractById, clearContractCache } from "../contracts/contract-validator";
import * as fs from "fs";
import * as path from "path";

describe("AE2 Contract Validator", () => {
  const contractsDir = path.join(__dirname, "..", "contracts");

  beforeEach(() => {
    // Limpar cache antes de cada teste
    clearContractCache();
  });

  describe("validateContracts()", () => {
    it("deve validar todos os contratos em modo fullstack", async () => {
      const result = await validateContracts("fullstack", contractsDir);
      expect(result).toBe(true);
    });

    it("deve validar todos os contratos em modo lite", async () => {
      const result = await validateContracts("lite", contractsDir);
      expect(result).toBe(true);
    });

    it("deve retornar false se diretório não existir", async () => {
      const result = await validateContracts("fullstack", "/caminho/inexistente");
      expect(result).toBe(false);
    });

    it("deve encontrar pelo menos 8 contratos", async () => {
      const files = fs.readdirSync(contractsDir);
      const contracts = files.filter((f) => f.endsWith(".contract.yaml"));
      expect(contracts.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("validateContractById()", () => {
    it("deve validar contrato específico m1-m2", async () => {
      const result = await validateContractById("m1_m2", "fullstack", contractsDir);
      expect(result).toBe(true);
    });

    it("deve validar contrato específico m2-m3", async () => {
      const result = await validateContractById("m2_m3", "fullstack", contractsDir);
      expect(result).toBe(true);
    });

    it("deve retornar false para contrato inexistente", async () => {
      const result = await validateContractById("m99_m99", "fullstack", contractsDir);
      expect(result).toBe(false);
    });

    it("deve funcionar em modo lite", async () => {
      const result = await validateContractById("m1_m2", "lite", contractsDir);
      expect(result).toBe(true);
    });
  });

  describe("Estrutura dos Contratos", () => {
    const contractFiles = [
      "m1-m2.contract.yaml",
      "m2-m3.contract.yaml",
      "m1-m5.contract.yaml",
      "m2-m4.contract.yaml",
      "m1-m6.contract.yaml",
      "m1-m8.contract.yaml",
      "m2-m7.contract.yaml",
      "m3-m8.contract.yaml",
    ];

    contractFiles.forEach((file) => {
      it(`deve ter arquivo ${file}`, () => {
        const filePath = path.join(contractsDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it("todos os contratos devem ter contract_id", async () => {
      const yaml = await import("yaml");
      for (const file of contractFiles) {
        const content = fs.readFileSync(path.join(contractsDir, file), "utf-8");
        const contract = yaml.parse(content);
        expect(contract).toHaveProperty("contract_id");
        expect(contract.contract_id).toBeTruthy();
      }
    });

    it("todos os contratos devem ter version", async () => {
      const yaml = await import("yaml");
      for (const file of contractFiles) {
        const content = fs.readFileSync(path.join(contractsDir, file), "utf-8");
        const contract = yaml.parse(content);
        expect(contract).toHaveProperty("version");
        expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });

    it("todos os contratos devem ter enabled_in", async () => {
      const yaml = await import("yaml");
      for (const file of contractFiles) {
        const content = fs.readFileSync(path.join(contractsDir, file), "utf-8");
        const contract = yaml.parse(content);
        expect(contract).toHaveProperty("enabled_in");
        expect(["lite", "fullstack"]).toContain(contract.enabled_in);
      }
    });
  });

  describe("Cache de Contratos", () => {
    it("deve usar cache em chamadas subsequentes", async () => {
      // Primeira chamada - carrega do disco
      const result1 = await validateContractById("m1_m2", "fullstack", contractsDir);
      expect(result1).toBe(true);

      // Segunda chamada - deve usar cache
      const result2 = await validateContractById("m1_m2", "fullstack", contractsDir);
      expect(result2).toBe(true);
    });

    it("deve limpar cache corretamente", async () => {
      await validateContractById("m1_m2", "fullstack", contractsDir);
      clearContractCache();
      const result = await validateContractById("m1_m2", "fullstack", contractsDir);
      expect(result).toBe(true);
    });
  });

  describe("Validação de Formato", () => {
    it("deve aceitar contract_id no formato m#_m#_*", async () => {
      const yaml = await import("yaml");
      const content = fs.readFileSync(path.join(contractsDir, "m1-m2.contract.yaml"), "utf-8");
      const contract = yaml.parse(content);
      expect(contract.contract_id).toMatch(/^m\d+_m\d+_/);
    });

    it("deve aceitar version no formato semver", async () => {
      const yaml = await import("yaml");
      const content = fs.readFileSync(path.join(contractsDir, "m1-m2.contract.yaml"), "utf-8");
      const contract = yaml.parse(content);
      expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
