/**
 * Tipos de cláusula suportados
 */
export type ClauseType =
  | "legal"
  | "contractual"
  | "privacy"
  | "terms_of_service"
  | "disclaimer"
  | "warranty"
  | "liability"
  | "confidentiality"
  | "termination"
  | "custom";

/**
 * Formato de saída
 */
export type OutputFormat = "text" | "markdown" | "html" | "json";

/**
 * Estilo de linguagem
 */
export type LanguageStyle = "formal" | "semi_formal" | "plain" | "technical";

/**
 * Idioma suportado
 */
export type Language = "pt_BR" | "en_US" | "es_ES";

/**
 * Definição de variável para substituição
 */
export type TemplateVariable = {
  name: string;
  value: string;
  required?: boolean;
};

/**
 * Subseção de uma cláusula
 */
export type SubSection = {
  title: string;
  content: string;
  numbering?: string;
};

/**
 * Cláusula individual
 */
export type ClauseDefinition = {
  id?: string;
  type: ClauseType;
  title?: string;
  template?: string;
  content?: string;
  variables?: TemplateVariable[];
  subsections?: SubSection[];
  order?: number;
};

/**
 * Configuração do gerador
 */
export type ClauseConfig = {
  clauses: ClauseDefinition[];
  format?: OutputFormat;
  style?: LanguageStyle;
  language?: Language;
  documentTitle?: string;
  documentVersion?: string;
  effectiveDate?: string;
  includeNumbering?: boolean;
  includeTableOfContents?: boolean;
  headerText?: string;
  footerText?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Resultado da geração
 */
export type ClauseResult = {
  document: string;
  format: OutputFormat;
  clauseCount: number;
  wordCount: number;
  characterCount: number;
  generatedAt: Date;
  metadata: {
    title?: string;
    version?: string;
    effectiveDate?: string;
    language: Language;
    style: LanguageStyle;
    clauseIds: string[];
  };
  tableOfContents?: string[];
};
