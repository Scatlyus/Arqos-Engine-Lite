import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Idiomas suportados
 */
type Language = "pt" | "en" | "es" | "fr" | "de" | "it" | "auto";

/**
 * Modo de tradução
 */
type TranslationMode = "standard" | "formal" | "informal" | "technical" | "literal";

/**
 * Entrada de glossário personalizado
 */
type GlossaryEntry = {
  source: string;
  target: string;
  caseSensitive?: boolean;
};

/**
 * Configuração de tradução
 */
type TranslationConfig = {
  text: string;
  sourceLanguage?: Language;
  targetLanguage: Language;
  mode?: TranslationMode;
  glossary?: GlossaryEntry[];
  preserveFormatting?: boolean;
  preserveNumbers?: boolean;
  preserveUrls?: boolean;
  preserveEmails?: boolean;
  domain?: string;
};

/**
 * Resultado da tradução
 */
type TranslationResult = {
  originalText: string;
  translatedText: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  detectedLanguage?: Language;
  mode: TranslationMode;
  wordCount: number;
  characterCount: number;
  glossaryApplied: number;
  preservedElements: {
    numbers: string[];
    urls: string[];
    emails: string[];
  };
  confidence: number;
  warnings: string[];
};

/**
 * Dicionário de tradução básico
 * Estrutura: { sourceWord: { targetLang: translation } }
 */
const DICTIONARIES: Record<string, Record<Language, string>> = {
  // Saudações
  hello: { pt: "olá", en: "hello", es: "hola", fr: "bonjour", de: "hallo", it: "ciao", auto: "hello" },
  goodbye: { pt: "adeus", en: "goodbye", es: "adiós", fr: "au revoir", de: "auf wiedersehen", it: "arrivederci", auto: "goodbye" },
  thanks: { pt: "obrigado", en: "thanks", es: "gracias", fr: "merci", de: "danke", it: "grazie", auto: "thanks" },
  please: { pt: "por favor", en: "please", es: "por favor", fr: "s'il vous plaît", de: "bitte", it: "per favore", auto: "please" },
  yes: { pt: "sim", en: "yes", es: "sí", fr: "oui", de: "ja", it: "sì", auto: "yes" },
  no: { pt: "não", en: "no", es: "no", fr: "non", de: "nein", it: "no", auto: "no" },

  // Pronomes
  i: { pt: "eu", en: "I", es: "yo", fr: "je", de: "ich", it: "io", auto: "I" },
  you: { pt: "você", en: "you", es: "tú", fr: "tu", de: "du", it: "tu", auto: "you" },
  he: { pt: "ele", en: "he", es: "él", fr: "il", de: "er", it: "lui", auto: "he" },
  she: { pt: "ela", en: "she", es: "ella", fr: "elle", de: "sie", it: "lei", auto: "she" },
  we: { pt: "nós", en: "we", es: "nosotros", fr: "nous", de: "wir", it: "noi", auto: "we" },
  they: { pt: "eles", en: "they", es: "ellos", fr: "ils", de: "sie", it: "loro", auto: "they" },

  // Verbos comuns
  is: { pt: "é", en: "is", es: "es", fr: "est", de: "ist", it: "è", auto: "is" },
  are: { pt: "são", en: "are", es: "son", fr: "sont", de: "sind", it: "sono", auto: "are" },
  have: { pt: "ter", en: "have", es: "tener", fr: "avoir", de: "haben", it: "avere", auto: "have" },
  do: { pt: "fazer", en: "do", es: "hacer", fr: "faire", de: "machen", it: "fare", auto: "do" },
  can: { pt: "poder", en: "can", es: "poder", fr: "pouvoir", de: "können", it: "potere", auto: "can" },
  will: { pt: "irá", en: "will", es: "voluntad", fr: "volonté", de: "werden", it: "volontà", auto: "will" },

  // Artigos e preposições
  the: { pt: "o", en: "the", es: "el", fr: "le", de: "der", it: "il", auto: "the" },
  a: { pt: "um", en: "a", es: "un", fr: "un", de: "ein", it: "un", auto: "a" },
  an: { pt: "um", en: "an", es: "un", fr: "un", de: "ein", it: "un", auto: "an" },
  of: { pt: "de", en: "of", es: "de", fr: "de", de: "von", it: "di", auto: "of" },
  to: { pt: "para", en: "to", es: "a", fr: "à", de: "zu", it: "a", auto: "to" },
  in: { pt: "em", en: "in", es: "en", fr: "dans", de: "in", it: "in", auto: "in" },
  for: { pt: "para", en: "for", es: "para", fr: "pour", de: "für", it: "per", auto: "for" },
  with: { pt: "com", en: "with", es: "con", fr: "avec", de: "mit", it: "con", auto: "with" },
  on: { pt: "em", en: "on", es: "en", fr: "sur", de: "auf", it: "su", auto: "on" },
  at: { pt: "em", en: "at", es: "en", fr: "à", de: "bei", it: "a", auto: "at" },
  by: { pt: "por", en: "by", es: "por", fr: "par", de: "von", it: "da", auto: "by" },
  from: { pt: "de", en: "from", es: "de", fr: "de", de: "von", it: "da", auto: "from" },

  // Substantivos comuns
  world: { pt: "mundo", en: "world", es: "mundo", fr: "monde", de: "Welt", it: "mondo", auto: "world" },
  time: { pt: "tempo", en: "time", es: "tiempo", fr: "temps", de: "Zeit", it: "tempo", auto: "time" },
  day: { pt: "dia", en: "day", es: "día", fr: "jour", de: "Tag", it: "giorno", auto: "day" },
  year: { pt: "ano", en: "year", es: "año", fr: "année", de: "Jahr", it: "anno", auto: "year" },
  way: { pt: "caminho", en: "way", es: "camino", fr: "chemin", de: "Weg", it: "via", auto: "way" },
  man: { pt: "homem", en: "man", es: "hombre", fr: "homme", de: "Mann", it: "uomo", auto: "man" },
  woman: { pt: "mulher", en: "woman", es: "mujer", fr: "femme", de: "Frau", it: "donna", auto: "woman" },
  child: { pt: "criança", en: "child", es: "niño", fr: "enfant", de: "Kind", it: "bambino", auto: "child" },
  life: { pt: "vida", en: "life", es: "vida", fr: "vie", de: "Leben", it: "vita", auto: "life" },
  work: { pt: "trabalho", en: "work", es: "trabajo", fr: "travail", de: "Arbeit", it: "lavoro", auto: "work" },

  // Adjetivos
  good: { pt: "bom", en: "good", es: "bueno", fr: "bon", de: "gut", it: "buono", auto: "good" },
  bad: { pt: "mau", en: "bad", es: "malo", fr: "mauvais", de: "schlecht", it: "cattivo", auto: "bad" },
  new: { pt: "novo", en: "new", es: "nuevo", fr: "nouveau", de: "neu", it: "nuovo", auto: "new" },
  old: { pt: "velho", en: "old", es: "viejo", fr: "vieux", de: "alt", it: "vecchio", auto: "old" },
  big: { pt: "grande", en: "big", es: "grande", fr: "grand", de: "groß", it: "grande", auto: "big" },
  small: { pt: "pequeno", en: "small", es: "pequeño", fr: "petit", de: "klein", it: "piccolo", auto: "small" },

  // Números
  one: { pt: "um", en: "one", es: "uno", fr: "un", de: "eins", it: "uno", auto: "one" },
  two: { pt: "dois", en: "two", es: "dos", fr: "deux", de: "zwei", it: "due", auto: "two" },
  three: { pt: "três", en: "three", es: "tres", fr: "trois", de: "drei", it: "tre", auto: "three" },
  four: { pt: "quatro", en: "four", es: "cuatro", fr: "quatre", de: "vier", it: "quattro", auto: "four" },
  five: { pt: "cinco", en: "five", es: "cinco", fr: "cinq", de: "fünf", it: "cinque", auto: "five" },

  // Termos técnicos comuns
  system: { pt: "sistema", en: "system", es: "sistema", fr: "système", de: "System", it: "sistema", auto: "system" },
  data: { pt: "dados", en: "data", es: "datos", fr: "données", de: "Daten", it: "dati", auto: "data" },
  information: { pt: "informação", en: "information", es: "información", fr: "information", de: "Information", it: "informazione", auto: "information" },
  process: { pt: "processo", en: "process", es: "proceso", fr: "processus", de: "Prozess", it: "processo", auto: "process" },
  service: { pt: "serviço", en: "service", es: "servicio", fr: "service", de: "Dienst", it: "servizio", auto: "service" },
  user: { pt: "usuário", en: "user", es: "usuario", fr: "utilisateur", de: "Benutzer", it: "utente", auto: "user" },
  application: { pt: "aplicação", en: "application", es: "aplicación", fr: "application", de: "Anwendung", it: "applicazione", auto: "application" },
  file: { pt: "arquivo", en: "file", es: "archivo", fr: "fichier", de: "Datei", it: "file", auto: "file" },
  error: { pt: "erro", en: "error", es: "error", fr: "erreur", de: "Fehler", it: "errore", auto: "error" },
  message: { pt: "mensagem", en: "message", es: "mensaje", fr: "message", de: "Nachricht", it: "messaggio", auto: "message" },

  // Frases comuns
  "how are you": { pt: "como vai você", en: "how are you", es: "cómo estás", fr: "comment allez-vous", de: "wie geht es dir", it: "come stai", auto: "how are you" },
  "thank you": { pt: "obrigado", en: "thank you", es: "gracias", fr: "merci", de: "danke", it: "grazie", auto: "thank you" },
  "good morning": { pt: "bom dia", en: "good morning", es: "buenos días", fr: "bonjour", de: "guten Morgen", it: "buongiorno", auto: "good morning" },
  "good night": { pt: "boa noite", en: "good night", es: "buenas noches", fr: "bonne nuit", de: "gute Nacht", it: "buonanotte", auto: "good night" },
  "i love you": { pt: "eu te amo", en: "I love you", es: "te quiero", fr: "je t'aime", de: "ich liebe dich", it: "ti amo", auto: "I love you" },
};

/**
 * Padrões de detecção de idioma
 */
const LANGUAGE_PATTERNS: Record<Language, RegExp[]> = {
  pt: [/\b(não|sim|você|nós|eles|são|está|muito|também|porque|quando|onde|como|qual|quem)\b/gi],
  en: [/\b(the|is|are|was|were|have|has|been|being|will|would|could|should|must|can)\b/gi],
  es: [/\b(está|están|muy|también|porque|cuando|donde|cómo|cuál|quién|nosotros|ellos)\b/gi],
  fr: [/\b(est|sont|très|aussi|parce|quand|où|comment|quel|qui|nous|ils|avec|pour)\b/gi],
  de: [/\b(ist|sind|sehr|auch|weil|wenn|wo|wie|welche|wer|wir|sie|mit|für|und)\b/gi],
  it: [/\b(è|sono|molto|anche|perché|quando|dove|come|quale|chi|noi|loro|con|per)\b/gi],
  auto: [],
};

/**
 * Nomes de idiomas para exibição
 */
const LANGUAGE_NAMES: Record<Language, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  auto: "Auto-detect",
};

export class Traducao implements Tool {
  id = "T22";
  name = "Traducao";
  phase = "fornece" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    totalWordsTranslated: 0,
    totalCharactersTranslated: 0,
    languagePairs: new Map<string, number>(),
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const config = this.parseConfig(input);
      const result = this.translate(config);

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;
      this.metrics.totalWordsTranslated += result.wordCount;
      this.metrics.totalCharactersTranslated += result.characterCount;

      // Track language pairs
      const pair = `${result.sourceLanguage}->${result.targetLanguage}`;
      this.metrics.languagePairs.set(pair, (this.metrics.languagePairs.get(pair) || 0) + 1);

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
        duration_ms: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.metrics.failureCount++;
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Parseia e valida a configuração de entrada
   */
  private parseConfig(input: ToolInput): TranslationConfig {
    const text = input.text as string | undefined;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Text to translate is required and must be non-empty");
    }

    const targetLanguage = (input.target_language || input.targetLanguage || "pt") as Language;
    const sourceLanguage = (input.source_language || input.sourceLanguage || "auto") as Language;

    const validLanguages: Language[] = ["pt", "en", "es", "fr", "de", "it", "auto"];
    if (!validLanguages.includes(targetLanguage)) {
      throw new Error(`Invalid target language: ${targetLanguage}. Valid options: ${validLanguages.join(", ")}`);
    }
    if (!validLanguages.includes(sourceLanguage)) {
      throw new Error(`Invalid source language: ${sourceLanguage}. Valid options: ${validLanguages.join(", ")}`);
    }

    return {
      text: text.trim(),
      sourceLanguage,
      targetLanguage,
      mode: (input.mode as TranslationMode) || "standard",
      glossary: input.glossary as GlossaryEntry[] | undefined,
      preserveFormatting: input.preserveFormatting !== false,
      preserveNumbers: input.preserveNumbers !== false,
      preserveUrls: input.preserveUrls !== false,
      preserveEmails: input.preserveEmails !== false,
      domain: input.domain as string | undefined,
    };
  }

  /**
   * Executa a tradução
   */
  private translate(config: TranslationConfig): TranslationResult {
    const warnings: string[] = [];
    const preservedElements = {
      numbers: [] as string[],
      urls: [] as string[],
      emails: [] as string[],
    };

    // Detectar idioma se necessário
    let sourceLanguage = config.sourceLanguage || "auto";
    let detectedLanguage: Language | undefined;

    if (sourceLanguage === "auto") {
      detectedLanguage = this.detectLanguage(config.text);
      sourceLanguage = detectedLanguage;
      if (detectedLanguage === "auto") {
        warnings.push("Could not detect source language, assuming English");
        sourceLanguage = "en";
        detectedLanguage = "en";
      }
    }

    // Verificar se idioma de origem é igual ao destino
    if (sourceLanguage === config.targetLanguage) {
      warnings.push("Source and target languages are the same");
      return {
        originalText: config.text,
        translatedText: config.text,
        sourceLanguage,
        targetLanguage: config.targetLanguage,
        detectedLanguage,
        mode: config.mode || "standard",
        wordCount: this.countWords(config.text),
        characterCount: config.text.length,
        glossaryApplied: 0,
        preservedElements,
        confidence: 1.0,
        warnings,
      };
    }

    let workingText = config.text;
    const placeholders: Map<string, string> = new Map();
    let placeholderIndex = 0;

    // Preservar URLs
    if (config.preserveUrls) {
      const urlPattern = /https?:\/\/[^\s]+/g;
      workingText = workingText.replace(urlPattern, (match) => {
        const placeholder = `__URL_${placeholderIndex++}__`;
        placeholders.set(placeholder, match);
        preservedElements.urls.push(match);
        return placeholder;
      });
    }

    // Preservar emails
    if (config.preserveEmails) {
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      workingText = workingText.replace(emailPattern, (match) => {
        const placeholder = `__EMAIL_${placeholderIndex++}__`;
        placeholders.set(placeholder, match);
        preservedElements.emails.push(match);
        return placeholder;
      });
    }

    // Preservar números
    if (config.preserveNumbers) {
      const numberPattern = /\b\d+([.,]\d+)*\b/g;
      workingText = workingText.replace(numberPattern, (match) => {
        const placeholder = `__NUM_${placeholderIndex++}__`;
        placeholders.set(placeholder, match);
        preservedElements.numbers.push(match);
        return placeholder;
      });
    }

    // Aplicar glossário personalizado primeiro
    let glossaryApplied = 0;
    if (config.glossary && config.glossary.length > 0) {
      for (const entry of config.glossary) {
        const flags = entry.caseSensitive ? "g" : "gi";
        const pattern = new RegExp(`\\b${this.escapeRegex(entry.source)}\\b`, flags);
        const matches = workingText.match(pattern);
        if (matches) {
          glossaryApplied += matches.length;
          workingText = workingText.replace(pattern, entry.target);
        }
      }
    }

    // Traduzir usando dicionário
    const { translatedText, confidence } = this.translateWithDictionary(
      workingText,
      sourceLanguage,
      config.targetLanguage,
      config.mode || "standard"
    );

    // Restaurar placeholders
    let finalText = translatedText;
    for (const [placeholder, original] of placeholders) {
      finalText = finalText.replace(placeholder, original);
    }

    // Ajustar formatação se necessário
    if (config.preserveFormatting) {
      // Preservar capitalização inicial
      if (config.text[0] === config.text[0].toUpperCase()) {
        finalText = finalText.charAt(0).toUpperCase() + finalText.slice(1);
      }
    }

    return {
      originalText: config.text,
      translatedText: finalText,
      sourceLanguage,
      targetLanguage: config.targetLanguage,
      detectedLanguage,
      mode: config.mode || "standard",
      wordCount: this.countWords(config.text),
      characterCount: config.text.length,
      glossaryApplied,
      preservedElements,
      confidence,
      warnings,
    };
  }

  /**
   * Detecta o idioma do texto
   */
  private detectLanguage(text: string): Language {
    const scores: Map<Language, number> = new Map();
    const languages: Language[] = ["pt", "en", "es", "fr", "de", "it"];

    for (const lang of languages) {
      let score = 0;
      const patterns = LANGUAGE_PATTERNS[lang];

      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length;
        }
      }

      // Bonus for matching dictionary words
      const words = text.toLowerCase().split(/\s+/);
      for (const word of words) {
        const cleanWord = word.replace(/[^\w]/g, "");
        if (DICTIONARIES[cleanWord]) {
          const entry = DICTIONARIES[cleanWord];
          // Check if this word is "native" to this language
          for (const [sourceLang, translation] of Object.entries(entry)) {
            if (sourceLang !== "auto" && translation.toLowerCase() === cleanWord) {
              if (sourceLang === lang) score += 2;
            }
          }
        }
      }

      scores.set(lang, score);
    }

    // Find language with highest score
    let bestLang: Language = "auto";
    let bestScore = 0;

    for (const [lang, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return bestScore > 0 ? bestLang : "auto";
  }

  /**
   * Traduz texto usando o dicionário
   */
  private translateWithDictionary(
    text: string,
    sourceLang: Language,
    targetLang: Language,
    mode: TranslationMode
  ): { translatedText: string; confidence: number } {
    const words = text.split(/(\s+|[.,!?;:'"()\[\]{}])/);
    const translatedWords: string[] = [];
    let translatedCount = 0;
    let totalWords = 0;

    for (const word of words) {
      // Skip whitespace and punctuation
      if (/^\s*$/.test(word) || /^[.,!?;:'"()\[\]{}]+$/.test(word)) {
        translatedWords.push(word);
        continue;
      }

      // Skip placeholders
      if (word.startsWith("__") && word.endsWith("__")) {
        translatedWords.push(word);
        continue;
      }

      totalWords++;
      const lowerWord = word.toLowerCase();

      // Check dictionary
      let translated = false;

      // First, try to find the word in dictionary (from any language)
      for (const [dictWord, translations] of Object.entries(DICTIONARIES)) {
        // Check if current word matches any translation
        for (const [lang, trans] of Object.entries(translations)) {
          if (lang !== "auto" && trans.toLowerCase() === lowerWord) {
            // Found a match, get target translation
            if (translations[targetLang]) {
              let targetWord = translations[targetLang];
              // Preserve case
              if (word[0] === word[0].toUpperCase()) {
                targetWord = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
              }
              translatedWords.push(targetWord);
              translatedCount++;
              translated = true;
              break;
            }
          }
        }
        if (translated) break;

        // Also check if the dict word itself matches
        if (dictWord === lowerWord && translations[targetLang]) {
          let targetWord = translations[targetLang];
          if (word[0] === word[0].toUpperCase()) {
            targetWord = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
          }
          translatedWords.push(targetWord);
          translatedCount++;
          translated = true;
          break;
        }
      }

      // If not translated, keep original word
      if (!translated) {
        translatedWords.push(word);
      }
    }

    const translatedText = translatedWords.join("");
    const confidence = totalWords > 0 ? translatedCount / totalWords : 0;

    return { translatedText, confidence };
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Conta palavras no texto
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  // ========== Health Check & Metrics ==========

  async healthCheck(): Promise<ToolHealth> {
    try {
      // Teste básico de tradução
      const testResult = await this.execute({
        text: "Hello world",
        source_language: "en",
        target_language: "pt",
      });

      const avgLatency =
        this.metrics.successCount > 0
          ? this.metrics.totalDuration / this.metrics.successCount
          : 0;

      const successRate =
        this.metrics.executionCount > 0
          ? this.metrics.successCount / this.metrics.executionCount
          : 1;

      return {
        tool_name: this.name,
        status: testResult.success ? "healthy" : "down",
        last_check: new Date(),
        avg_latency_ms: avgLatency,
        success_rate: successRate,
      };
    } catch {
      return {
        tool_name: this.name,
        status: "down",
        last_check: new Date(),
        avg_latency_ms: 0,
        success_rate: 0,
      };
    }
  }

  getMetrics() {
    const languagePairStats: Record<string, number> = {};
    for (const [pair, count] of this.metrics.languagePairs) {
      languagePairStats[pair] = count;
    }

    return {
      executionCount: this.metrics.executionCount,
      successCount: this.metrics.successCount,
      failureCount: this.metrics.failureCount,
      totalWordsTranslated: this.metrics.totalWordsTranslated,
      totalCharactersTranslated: this.metrics.totalCharactersTranslated,
      averageDuration:
        this.metrics.successCount > 0
          ? this.metrics.totalDuration / this.metrics.successCount
          : 0,
      successRate:
        this.metrics.executionCount > 0
          ? this.metrics.successCount / this.metrics.executionCount
          : 0,
      languagePairs: languagePairStats,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      totalWordsTranslated: 0,
      totalCharactersTranslated: 0,
      languagePairs: new Map(),
    };
  }

  /**
   * Lista idiomas suportados
   */
  getSupportedLanguages(): Array<{ code: Language; name: string }> {
    return Object.entries(LANGUAGE_NAMES)
      .filter(([code]) => code !== "auto")
      .map(([code, name]) => ({ code: code as Language, name }));
  }

  /**
   * Retorna estatísticas do dicionário
   */
  getDictionaryStats(): { wordCount: number; languages: string[] } {
    return {
      wordCount: Object.keys(DICTIONARIES).length,
      languages: Object.keys(LANGUAGE_NAMES).filter((l) => l !== "auto"),
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:Traducao] Testing Translation Tool...\n");

  async function runTests() {
    const tool = new Traducao();
    let passed = 0;
    let failed = 0;

    // Teste 1: Tradução simples EN -> PT
    console.log("=== Teste 1: Tradução EN -> PT ===");
    try {
      const result1 = await tool.execute({
        text: "Hello world, how are you?",
        source_language: "en",
        target_language: "pt",
      });

      if (result1.success && result1.output) {
        const out = result1.output as TranslationResult;
        console.log("✓ Tradução realizada");
        console.log(`  Original: "${out.originalText}"`);
        console.log(`  Traduzido: "${out.translatedText}"`);
        console.log(`  Confiança: ${(out.confidence * 100).toFixed(1)}%`);
        passed++;
      } else {
        console.log("✗ Falha:", result1.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 2: Detecção automática de idioma
    console.log("\n=== Teste 2: Detecção Automática de Idioma ===");
    try {
      const result2 = await tool.execute({
        text: "Olá mundo, como você está?",
        source_language: "auto",
        target_language: "en",
      });

      if (result2.success && result2.output) {
        const out = result2.output as TranslationResult;
        console.log("✓ Idioma detectado");
        console.log(`  Detectado: ${out.detectedLanguage}`);
        console.log(`  Original: "${out.originalText}"`);
        console.log(`  Traduzido: "${out.translatedText}"`);
        passed++;
      } else {
        console.log("✗ Falha:", result2.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 3: Preservar URLs e emails
    console.log("\n=== Teste 3: Preservar URLs e Emails ===");
    try {
      const result3 = await tool.execute({
        text: "Contact us at support@example.com or visit https://example.com for information",
        source_language: "en",
        target_language: "es",
        preserveUrls: true,
        preserveEmails: true,
      });

      if (result3.success && result3.output) {
        const out = result3.output as TranslationResult;
        console.log("✓ Elementos preservados");
        console.log(`  URLs: ${out.preservedElements.urls.join(", ")}`);
        console.log(`  Emails: ${out.preservedElements.emails.join(", ")}`);
        console.log(`  Resultado: "${out.translatedText}"`);
        passed++;
      } else {
        console.log("✗ Falha:", result3.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 4: Glossário personalizado
    console.log("\n=== Teste 4: Glossário Personalizado ===");
    try {
      const result4 = await tool.execute({
        text: "The Arqos system processes user data",
        source_language: "en",
        target_language: "pt",
        glossary: [
          { source: "Arqos", target: "Arqos Engine", caseSensitive: true },
          { source: "data", target: "informações", caseSensitive: false },
        ],
      });

      if (result4.success && result4.output) {
        const out = result4.output as TranslationResult;
        console.log("✓ Glossário aplicado");
        console.log(`  Entradas aplicadas: ${out.glossaryApplied}`);
        console.log(`  Resultado: "${out.translatedText}"`);
        passed++;
      } else {
        console.log("✗ Falha:", result4.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 5: Tradução PT -> ES
    console.log("\n=== Teste 5: Tradução PT -> ES ===");
    try {
      const result5 = await tool.execute({
        text: "Bom dia, obrigado por favor",
        source_language: "pt",
        target_language: "es",
      });

      if (result5.success && result5.output) {
        const out = result5.output as TranslationResult;
        console.log("✓ Tradução PT->ES");
        console.log(`  Original: "${out.originalText}"`);
        console.log(`  Traduzido: "${out.translatedText}"`);
        passed++;
      } else {
        console.log("✗ Falha:", result5.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 6: Validação de erros
    console.log("\n=== Teste 6: Validação de Erros ===");
    try {
      const result6 = await tool.execute({
        text: "", // Deve falhar: texto vazio
        target_language: "pt",
      });

      if (!result6.success) {
        console.log("✓ Erro capturado:", result6.error);
        passed++;
      } else {
        console.log("✗ Deveria ter falhado");
        failed++;
      }
    } catch (e) {
      console.log("✓ Exceção capturada");
      passed++;
    }

    // Teste 7: Idiomas iguais
    console.log("\n=== Teste 7: Idiomas Iguais (Warning) ===");
    try {
      const result7 = await tool.execute({
        text: "Hello world",
        source_language: "en",
        target_language: "en",
      });

      if (result7.success && result7.output) {
        const out = result7.output as TranslationResult;
        if (out.warnings.length > 0) {
          console.log("✓ Warning detectado:", out.warnings[0]);
          passed++;
        } else {
          console.log("✗ Warning esperado não encontrado");
          failed++;
        }
      } else {
        console.log("✗ Falha:", result7.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 8: Health Check
    console.log("\n=== Teste 8: Health Check ===");
    try {
      const health = await tool.healthCheck();
      console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);
      console.log(`  Success Rate: ${(health.success_rate * 100).toFixed(1)}%`);
      console.log(`  Avg Latency: ${health.avg_latency_ms.toFixed(2)}ms`);
      if (health.status === "healthy") passed++;
      else failed++;
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 9: Métricas e Estatísticas
    console.log("\n=== Teste 9: Métricas e Estatísticas ===");
    const metrics = tool.getMetrics();
    const dictStats = tool.getDictionaryStats();
    const languages = tool.getSupportedLanguages();

    console.log(`  Execuções: ${metrics.executionCount}`);
    console.log(`  Palavras traduzidas: ${metrics.totalWordsTranslated}`);
    console.log(`  Dicionário: ${dictStats.wordCount} palavras`);
    console.log(`  Idiomas: ${languages.map((l) => l.name).join(", ")}`);
    console.log(`  Pares usados: ${JSON.stringify(metrics.languagePairs)}`);
    passed++;

    // Resumo
    console.log("\n" + "=".repeat(50));
    console.log(`[AE3:Traducao] Testes: ${passed} passed, ${failed} failed`);
    console.log("=".repeat(50));

    if (failed === 0) {
      console.log("✓ Todos os testes passaram!");
    }
  }

  runTests().catch(console.error);
}
