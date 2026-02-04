import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type MarketQuote = {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  currency: string;
  timestamp: string;
  source: string;
  confidence: number;
};

type OHLCV = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MarketHistory = {
  symbol: string;
  currency: string;
  series: OHLCV[];
};

type MarketOutput = {
  quotes: MarketQuote[];
  history?: MarketHistory[];
  indicators?: Record<string, unknown>;
};

type FetchOptions = {
  mode?: "quote" | "history" | "both";
  history_days?: number;
  currency?: string;
  source?: string;
  volatility?: number;
  trend?: number;
  include_indicators?: boolean;
};

export class MarketDataFetcher implements Tool {
  id = "T9";
  name = "MarketDataFetcher";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const symbols = this.normalizeSymbols(input.symbol ?? input.symbols ?? []);
      const options = this.normalizeOptions(input);
      const now = new Date();

      let quotes: MarketQuote[] = [];

      // [Real implementation] Try to fetch from CoinGecko for crypto
      if (options.source === "real" || options.source === "coingecko") {
        try {
          quotes = await this.fetchFromCoinGecko(symbols, options);
        } catch (e) {
          console.warn("[AE3:MarketDataFetcher] CoinGecko fetch failed, falling back to simulation.", e);
          quotes = symbols.map((symbol) => this.generateQuote(symbol, options, now));
        }
      } else {
        quotes = symbols.map((symbol) => this.generateQuote(symbol, options, now));
      }

      const history = options.mode !== "quote" ? this.generateHistory(symbols, options, now) : undefined;
      const indicators = options.include_indicators ? this.computeIndicators(history ?? []) : undefined;

      this.successCount += 1;
      this.totalDuration += Date.now() - startTime;

      const output: MarketOutput = {
        quotes,
        history,
        indicators
      };

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output,
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "MarketDataFetcher failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 10;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private normalizeSymbols(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.map((value) => String(value).trim().toUpperCase()).filter(Boolean);
    }

    const single = String(raw ?? "").trim().toUpperCase();
    return single ? [single] : ["UNKNOWN"];
  }

  private normalizeOptions(input: ToolInput): FetchOptions {
    const mode = (input.mode ?? "quote") as FetchOptions["mode"];
    const historyDaysRaw = Number(input.history_days ?? 30);

    return {
      mode: mode === "both" || mode === "history" ? mode : "quote",
      history_days: Number.isFinite(historyDaysRaw) ? Math.max(5, Math.min(historyDaysRaw, 365)) : 30,
      currency: String(input.currency ?? "USD"),
      source: String(input.source ?? "simulated"),
      volatility: this.clampNumber(input.volatility, 0.005, 0.25, 0.04),
      trend: this.clampNumber(input.trend, -0.08, 0.12, 0.01),
      include_indicators: Boolean(input.include_indicators ?? false)
    };
  }

  private generateQuote(symbol: string, options: FetchOptions, now: Date): MarketQuote {
    const base = this.seededBasePrice(symbol);
    const noise = this.seededNoise(symbol, now.getTime()) * base * (options.volatility ?? 0.04);
    const trendMove = base * (options.trend ?? 0.01);
    const price = this.roundTo(base + trendMove + noise, 2);
    const prevClose = this.roundTo(base + noise * 0.4, 2);
    const change = this.roundTo(price - prevClose, 2);
    const changePercent = prevClose ? this.roundTo((change / prevClose) * 100, 2) : 0;

    return {
      symbol,
      price,
      change,
      change_percent: changePercent,
      currency: options.currency ?? "USD",
      timestamp: now.toISOString(),
      source: options.source ?? "simulated",
      confidence: this.roundTo(0.85 + Math.abs(noise) * 0.01, 2)
    };
  }

  private generateHistory(symbols: string[], options: FetchOptions, now: Date): MarketHistory[] {
    const days = options.history_days ?? 30;
    const seriesBySymbol: MarketHistory[] = [];

    for (const symbol of symbols) {
      const base = this.seededBasePrice(symbol);
      const series: OHLCV[] = [];
      let prevClose = base;

      for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
        const daySeed = this.seededNoise(symbol, date.getTime());
        const drift = prevClose * (options.trend ?? 0.01) / days;
        const shock = daySeed * prevClose * (options.volatility ?? 0.04);
        const open = prevClose;
        const close = this.roundTo(open + drift + shock, 2);
        const high = this.roundTo(Math.max(open, close) * (1 + Math.abs(daySeed) * 0.03), 2);
        const low = this.roundTo(Math.min(open, close) * (1 - Math.abs(daySeed) * 0.03), 2);
        const volume = Math.floor(100000 + Math.abs(daySeed) * 900000);

        series.push({
          date: date.toISOString().slice(0, 10),
          open: this.roundTo(open, 2),
          high,
          low,
          close,
          volume
        });

        prevClose = close;
      }

      seriesBySymbol.push({
        symbol,
        currency: options.currency ?? "USD",
        series
      });
    }

    return seriesBySymbol;
  }

  private computeIndicators(history: MarketHistory[]): Record<string, unknown> {
    const indicators: Record<string, unknown> = {};

    for (const entry of history) {
      const closes = entry.series.map((item) => item.close);
      const sma = this.simpleMovingAverage(closes, 5);
      const ema = this.exponentialMovingAverage(closes, 5);
      const rsi = this.relativeStrengthIndex(closes, 14);

      indicators[entry.symbol] = {
        sma_5: sma ? this.roundTo(sma, 2) : null,
        ema_5: ema ? this.roundTo(ema, 2) : null,
        rsi_14: rsi ? this.roundTo(rsi, 2) : null
      };
    }

    return indicators;
  }

  private seededBasePrice(symbol: string): number {
    const hash = this.hashString(symbol);
    return 25 + (hash % 350) + (hash % 100) / 10;
  }

  private seededNoise(symbol: string, seed: number): number {
    const hash = this.hashString(symbol + String(seed));
    return ((hash % 2000) / 1000 - 1) * 0.9;
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  private roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private simpleMovingAverage(values: number[], window: number): number | null {
    if (values.length < window) return null;
    const slice = values.slice(-window);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / window;
  }

  private exponentialMovingAverage(values: number[], window: number): number | null {
    if (values.length < window) return null;
    const k = 2 / (window + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i += 1) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private relativeStrengthIndex(values: number[], window: number): number | null {
    if (values.length <= window) return null;
    let gains = 0;
    let losses = 0;
    for (let i = values.length - window; i < values.length; i += 1) {
      const delta = values[i] - values[i - 1];
      if (delta >= 0) gains += delta;
      else losses += Math.abs(delta);
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  private async fetchFromCoinGecko(symbols: string[], options: FetchOptions): Promise<MarketQuote[]> {
    const cryptoMap: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      SOL: "solana",
      ADA: "cardano",
      DOT: "polkadot",
    };

    const ids = symbols
      .map((s) => cryptoMap[s.toUpperCase()])
      .filter(Boolean)
      .join(",");

    if (!ids) {
      // Fallback if no crypto symbols found
      return symbols.map((symbol) => this.generateQuote(symbol, options, new Date()));
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${options.currency?.toLowerCase() || "usd"}&include_24hr_change=true`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("CoinGecko API error");

    const data = await response.json();
    const now = new Date().toISOString();

    return symbols.map((symbol) => {
      const id = cryptoMap[symbol.toUpperCase()];
      const priceData = data[id];

      if (!priceData) return this.generateQuote(symbol, options, new Date());

      const currencyKey = options.currency?.toLowerCase() || "usd";
      const changeKey = `${currencyKey}_24h_change`;

      return {
        symbol: symbol.toUpperCase(),
        price: priceData[currencyKey],
        change: (priceData[currencyKey] * (priceData[changeKey] || 0)) / 100,
        change_percent: priceData[changeKey] || 0,
        currency: options.currency || "USD",
        timestamp: now,
        source: "coingecko",
        confidence: 0.98,
      };
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const tool = new MarketDataFetcher();
  console.log("[AE3:MarketDataFetcher] Testing MarketDataFetcher...\n");

  tool
    .execute({ symbols: ["AAPL", "TSLA"], mode: "both", history_days: 10, include_indicators: true })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:MarketDataFetcher] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:MarketDataFetcher] Test failed", error);
    });
}
