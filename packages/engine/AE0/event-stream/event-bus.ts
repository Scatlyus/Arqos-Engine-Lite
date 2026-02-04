/**
 * Event Bus para AE0 Event Stream
 * Implementa pub/sub pattern com suporte a prioridades e modos operacionais
 */

import { InMemoryBuffer, EventBuffer } from "./in-memory-buffer";
import { PriorityQueue, PriorityEvent, PriorityEventFactory } from "./priority-queue";

export type EventMode = "lite" | "fullstack";

export interface EventPublishOptions {
  priority?: number;
  source?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export interface EventRecord {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  timestamp: number;
  source?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export type EventHandler = (payload: unknown, meta: EventRecord) => void | Promise<void>;

export interface EventBusStats {
  mode: EventMode;
  subscriberCount: number;
  eventTypeCount: number;
  queueSize: number;
  totalPublished: number;
  totalDispatched: number;
  totalErrors: number;
}

export interface EventBusOptions {
  mode?: EventMode;
  bufferLimit?: number;
  asyncHandlers?: boolean;
  errorHandler?: (error: Error, event: EventRecord) => void;
}

// Event bus abstraction
export interface EventBus {
  publish(eventType: string, payload: unknown, options?: EventPublishOptions): void;
  subscribe(eventType: string, handler: EventHandler): () => void;
  unsubscribe(eventType: string, handler?: EventHandler): void;
  getStats(): EventBusStats;
  clear(): void;
}

const DEFAULT_BUFFER_LIMIT = 1000;
const DEFAULT_PRIORITY = 50;

class EventBusCore implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly queue: PriorityQueue<EventRecord> | InMemoryBuffer<EventRecord>;
  private readonly mode: EventMode;
  private readonly asyncHandlers: boolean;
  private readonly errorHandler?: (error: Error, event: EventRecord) => void;

  private processing = false;
  private sequence = 0;

  // Estatísticas
  private totalPublished = 0;
  private totalDispatched = 0;
  private totalErrors = 0;

  constructor(options: EventBusOptions = {}) {
    this.mode = options.mode || "lite";
    this.asyncHandlers = options.asyncHandlers ?? false;
    this.errorHandler = options.errorHandler;

    const bufferLimit = options.bufferLimit || DEFAULT_BUFFER_LIMIT;

    // Usar componentes melhorados
    if (this.mode === "fullstack") {
      this.queue = new PriorityQueue<EventRecord>();
    } else {
      this.queue = new InMemoryBuffer<EventRecord>({
        capacity: bufferLimit,
        overflowStrategy: 'drop-oldest'
      });
    }
  }

  publish(eventType: string, payload: unknown, options?: EventPublishOptions): void {
    const now = Date.now();
    const event: EventRecord = {
      id: `${now}-${this.sequence++}`,
      type: eventType,
      payload,
      priority: options?.priority ?? DEFAULT_PRIORITY,
      timestamp: now,
      source: options?.source,
      traceId: options?.traceId,
      metadata: options?.metadata
    };

    this.totalPublished++;

    if (this.mode === "fullstack") {
      (this.queue as PriorityQueue<EventRecord>).enqueue(event, event.priority);
    } else {
      (this.queue as InMemoryBuffer<EventRecord>).push(event);
    }

    this.processQueue();
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    const existing = this.handlers.get(eventType);
    if (existing) {
      existing.add(handler);
    } else {
      this.handlers.set(eventType, new Set([handler]));
    }

    // Retornar função de unsubscribe
    return () => this.unsubscribe(eventType, handler);
  }

  unsubscribe(eventType: string, handler?: EventHandler): void {
    if (!handler) {
      // Remove todos os handlers do tipo
      this.handlers.delete(eventType);
      return;
    }

    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlers.delete(eventType);
    }
  }

  getStats(): EventBusStats {
    let subscriberCount = 0;
    for (const handlers of this.handlers.values()) {
      subscriberCount += handlers.size;
    }

    return {
      mode: this.mode,
      subscriberCount,
      eventTypeCount: this.handlers.size,
      queueSize: this.queue.size(),
      totalPublished: this.totalPublished,
      totalDispatched: this.totalDispatched,
      totalErrors: this.totalErrors
    };
  }

  clear(): void {
    this.handlers.clear();
    if (this.mode === "fullstack") {
      (this.queue as PriorityQueue<EventRecord>).clear();
    } else {
      (this.queue as InMemoryBuffer<EventRecord>).clear();
    }
  }

  private processQueue(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      if (this.mode === "fullstack") {
        const queue = this.queue as PriorityQueue<EventRecord>;
        while (!queue.isEmpty()) {
          const event = queue.dequeue();
          if (event) {
            this.dispatch(event);
          }
        }
      } else {
        const buffer = this.queue as InMemoryBuffer<EventRecord>;
        const events = buffer.drain();
        for (const event of events) {
          this.dispatch(event);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private dispatch(event: EventRecord): void {
    const directHandlers = this.handlers.get(event.type);
    const wildcardHandlers = this.handlers.get("*");

    if (!directHandlers && !wildcardHandlers) {
      return;
    }

    this.totalDispatched++;

    // Handlers diretos
    if (directHandlers) {
      for (const handler of directHandlers) {
        this.invokeHandler(handler, event);
      }
    }

    // Handlers wildcard
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        this.invokeHandler(handler, event);
      }
    }
  }

  private invokeHandler(handler: EventHandler, event: EventRecord): void {
    try {
      const result = handler(event.payload, event);

      // Se handler é assíncrono e asyncHandlers habilitado
      if (this.asyncHandlers && result instanceof Promise) {
        result.catch(error => this.handleError(error, event));
      }
    } catch (error) {
      this.handleError(error as Error, event);
    }
  }

  private handleError(error: Error, event: EventRecord): void {
    this.totalErrors++;

    if (this.errorHandler) {
      try {
        this.errorHandler(error, event);
      } catch (handlerError) {
        console.error(`[AE0] Erro no error handler:`, handlerError);
      }
    } else {
      console.error(`[AE0] Erro ao processar evento ${event.type}:`, error);
    }
  }
}

// Singleton global
let eventBusInstance: EventBusCore | null = null;

/**
 * Inicializa o Event Stream
 */
export async function initializeEventStream(
  modeOrOptions?: EventMode | EventBusOptions
): Promise<EventBus> {
  if (eventBusInstance) {
    console.log("[AE0] Event stream já inicializado");
    return eventBusInstance;
  }

  let options: EventBusOptions = {};

  if (typeof modeOrOptions === 'string') {
    // API legada
    options.mode = modeOrOptions;
    options.bufferLimit = Number(process.env.ARQOS_EVENT_BUFFER_LIMIT) || DEFAULT_BUFFER_LIMIT;
  } else if (modeOrOptions) {
    // API nova
    options = modeOrOptions;
  }

  eventBusInstance = new EventBusCore(options);
  console.log(`[AE0] Event stream inicializado (${options.mode || 'lite'})`);

  return eventBusInstance;
}

/**
 * Retorna a instância do Event Bus
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    throw new Error("[AE0] Event bus not initialized. Call initializeEventStream() first.");
  }
  return eventBusInstance;
}

/**
 * Reseta o Event Bus (útil para testes)
 */
export function resetEventBus(): void {
  eventBusInstance = null;
}

/**
 * Helper para criar um Event Bus local (não singleton)
 */
export function createEventBus(options?: EventBusOptions): EventBus {
  return new EventBusCore(options);
}

// CLI para testes
if (require.main === module) {
  console.log('[AE0] Testando Event Bus...\n');

  async function runTests() {
    // Teste 1: Modo Lite
    console.log('=== Teste 1: Modo Lite ===');
    const liteBus = await initializeEventStream('lite');

    const unsubscribe = liteBus.subscribe('test.event', (payload, meta) => {
      console.log(`Recebido: ${payload} (prioridade: ${meta.priority})`);
    });

    liteBus.publish('test.event', 'Evento 1', { priority: 10 });
    liteBus.publish('test.event', 'Evento 2', { priority: 0 });

    console.log('Stats:', liteBus.getStats());
    unsubscribe();

    // Reset para próximo teste
    resetEventBus();

    // Teste 2: Modo Fullstack com prioridades
    console.log('\n=== Teste 2: Modo Fullstack ===');
    const fullstackBus = await initializeEventStream({
      mode: 'fullstack',
      asyncHandlers: true
    });

    fullstackBus.subscribe('*', (payload, meta) => {
      console.log(`[${meta.type}] ${payload} (P${meta.priority})`);
    });

    fullstackBus.publish('alert.critical', 'Alerta Crítico', { priority: 0 });
    fullstackBus.publish('task.normal', 'Task Normal', { priority: 50 });
    fullstackBus.publish('info.log', 'Info', { priority: 75 });

    console.log('Stats:', fullstackBus.getStats());

    // Teste 3: Error handling
    console.log('\n=== Teste 3: Error Handling ===');
    resetEventBus();

    const errorBus = await initializeEventStream({
      mode: 'lite',
      errorHandler: (error, event) => {
        console.log(`Custom error handler: ${error.message} for ${event.type}`);
      }
    });

    errorBus.subscribe('error.test', () => {
      throw new Error('Handler error simulado');
    });

    errorBus.publish('error.test', 'Test');
    console.log('Stats após erro:', errorBus.getStats());

    console.log('\n[AE0] ✓ Event Bus testado com sucesso');
  }

  runTests().catch(console.error);
}
