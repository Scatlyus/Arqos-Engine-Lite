export interface ToolDefinition {
  id: string;
  name: string;
  phase: "recebe" | "colhe" | "processa" | "fornece";
  version: string;
}
