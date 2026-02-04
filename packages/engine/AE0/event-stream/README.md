# AE0 Event Stream

Sistema de gerenciamento de eventos com suporte a prioridades e múltiplos modos operacionais.

## 📦 Componentes

### 1. Priority Queue (`priority-queue.ts`)

Fila de prioridade baseada em Min-Heap para ordenação eficiente de eventos.

**Características:**
- Complexidade O(log n) para inserção e remoção
- Complexidade O(1) para peek
- Suporte a eventos com prioridade e timestamp
- API compatível com código legado

**Exemplo de Uso:**

```typescript
import { PriorityQueue, PriorityEventFactory } from './priority-queue';

const queue = new PriorityQueue<string>();

// API simples
queue.enqueue('Task Normal', 50);
queue.enqueue('Alerta Crítico', 0);  // Menor = maior prioridade

// API avançada com eventos completos
queue.enqueueEvent(PriorityEventFactory.createHigh('Evento Crítico'));

// Processar por prioridade
while (!queue.isEmpty()) {
  const event = queue.dequeueEvent();
  console.log(`Prioridade ${event.priority}: ${event.data}`);
}

// Estatísticas
console.log(queue.getStats());
```

**Interface PriorityEvent:**
```typescript
interface PriorityEvent<T> {
  id: string;              // ID único gerado automaticamente
  priority: number;        // Menor valor = maior prioridade
  timestamp: number;       // Timestamp de criação
  data: T;                // Payload do evento
  metadata?: {            // Metadados opcionais
    source?: string;
    type?: string;
    [key: string]: any;
  };
}
```

**Métodos Principais:**
- `enqueue(value, priority)` - Adiciona evento (API legada)
- `enqueueEvent(event)` - Adiciona evento completo
- `dequeue()` - Remove e retorna valor de maior prioridade
- `dequeueEvent()` - Remove e retorna evento completo
- `peek()` - Retorna próximo valor sem remover
- `updatePriority(id, newPriority)` - Atualiza prioridade de evento
- `getStats()` - Estatísticas da fila

---

### 2. In-Memory Buffer (`in-memory-buffer.ts`)

Buffer circular em memória com múltiplas estratégias de overflow.

**Características:**
- Buffer circular com capacidade configurável
- 3 estratégias de overflow: drop-oldest, drop-newest, reject
- Estatísticas de utilização
- EventBuffer especializado para eventos com prioridade

**Exemplo de Uso:**

```typescript
import { InMemoryBuffer, EventBuffer } from './in-memory-buffer';

// Buffer básico
const buffer = new InMemoryBuffer<string>({
  capacity: 100,
  overflowStrategy: 'drop-oldest',
  onOverflow: (item) => console.log(`Dropped: ${item}`)
});

buffer.add('Item 1');
buffer.add('Item 2');

const item = buffer.poll();  // Remove primeiro item
const all = buffer.drainAll();  // Remove todos

// Event Buffer (especializado)
const eventBuffer = new EventBuffer({ capacity: 1000 });

eventBuffer.add({
  id: 'evt1',
  priority: 0,
  timestamp: Date.now(),
  data: 'Critical Event',
  metadata: { type: 'alert', source: 'AE2' }
});

// Queries especializadas
const alerts = eventBuffer.getByType('alert');
const ae2Events = eventBuffer.getBySource('AE2');
const critical = eventBuffer.getByMinPriority(10);
```

**Estratégias de Overflow:**
- `drop-oldest` - Remove item mais antigo ao atingir capacidade (padrão)
- `drop-newest` - Rejeita novo item ao atingir capacidade
- `reject` - Rejeita novo item e chama onOverflow

**Métodos Principais:**
- `add(value)` - Adiciona item ao buffer
- `poll()` - Remove e retorna primeiro item
- `peek()` - Retorna primeiro item sem remover
- `drainAll()` - Remove e retorna todos os itens
- `drainN(count)` - Remove e retorna N itens
- `getStats()` - Estatísticas do buffer

---

### 3. Event Bus (`event-bus.ts`)

Sistema pub/sub com suporte a prioridades e modos operacionais.

**Características:**
- Padrão Publisher/Subscriber
- Suporte a wildcards (`*`)
- Modo Lite: FIFO simples com buffer circular
- Modo Fullstack: Ordenação por prioridade com heap
- Handlers síncronos e assíncronos
- Error handling customizável
- Estatísticas em tempo real

**Exemplo de Uso:**

```typescript
import { initializeEventStream, getEventBus } from './event-bus';

// Inicializar (singleton)
await initializeEventStream({
  mode: 'fullstack',
  bufferLimit: 1000,
  asyncHandlers: true,
  errorHandler: (error, event) => {
    console.error(`Erro em ${event.type}:`, error);
  }
});

const bus = getEventBus();

// Subscribe a eventos
const unsubscribe = bus.subscribe('task.completed', (payload, meta) => {
  console.log(`Task completada: ${payload}`);
  console.log(`Prioridade: ${meta.priority}`);
});

// Subscribe wildcard (todos os eventos)
bus.subscribe('*', (payload, meta) => {
  console.log(`[${meta.type}] ${payload}`);
});

// Publicar eventos
bus.publish('task.completed', 'Compilação', {
  priority: 10,
  source: 'AE3',
  traceId: 'trace-123'
});

// Estatísticas
console.log(bus.getStats());

// Unsubscribe
unsubscribe();
```

**Modos Operacionais:**

| Modo | Queue | Ordenação | Uso |
|------|-------|-----------|-----|
| `lite` | InMemoryBuffer | FIFO | Desenvolvimento, testes |
| `fullstack` | PriorityQueue | Por prioridade | Produção |

**Interface EventRecord:**
```typescript
interface EventRecord {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  timestamp: number;
  source?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}
```

**Métodos Principais:**
- `publish(type, payload, options)` - Publica evento
- `subscribe(type, handler)` - Inscreve handler (retorna função de unsubscribe)
- `unsubscribe(type, handler?)` - Remove handler(s)
- `getStats()` - Estatísticas do bus
- `clear()` - Limpa todos os handlers e fila

---

## 🚀 Uso no Arqos Engine

### Inicialização no Bootstrap

```typescript
import { initializeEventStream } from './AE0/event-stream/event-bus';
import { resolveMode } from './AE0/validators/mode-validator';

// Resolver modo operacional
const mode = resolveMode();

// Inicializar event stream
await initializeEventStream({ mode });
```

### Publicar Eventos

```typescript
import { getEventBus } from './AE0/event-stream/event-bus';

const bus = getEventBus();

// Evento de lifecycle
bus.publish('ae0.bootstrap.complete', {
  version: '1.3.0',
  mode: 'fullstack'
}, {
  priority: 0,
  source: 'AE0'
});

// Evento de task
bus.publish('ae2.decision.made', {
  module: 'Strategist',
  decision: 'execute_plan_A'
}, {
  priority: 25,
  source: 'AE2',
  traceId: 'decision-xyz'
});
```

### Subscrever Eventos

```typescript
import { getEventBus } from './AE0/event-stream/event-bus';

const bus = getEventBus();

// AE1 escuta eventos de memória
bus.subscribe('ae1.memory.*', (payload, meta) => {
  console.log(`[AE1] Evento de memória: ${meta.type}`);
});

// AE2 escuta decisões críticas
bus.subscribe('ae2.decision.*', async (payload, meta) => {
  if (meta.priority <= 10) {
    await handleCriticalDecision(payload);
  }
});

// Monitor global
bus.subscribe('*', (payload, meta) => {
  logger.debug(`[${meta.source}] ${meta.type}`);
});
```

---

## 📊 Prioridades Padrão

| Prioridade | Categoria | Uso |
|------------|-----------|-----|
| 0-10 | Crítico | Alertas, erros fatais, eventos de lifecycle |
| 11-30 | Alto | Decisões importantes, eventos de sincronização |
| 31-50 | Normal | Tasks regulares, eventos de processamento |
| 51-75 | Baixo | Logs, debug, eventos informativos |
| 76-100 | Muito Baixo | Background tasks, limpeza |

---

## 🧪 Testes

Execute os testes integrados:

```bash
# Testar todos os componentes
npx ts-node AE0/event-stream/test-event-stream.ts

# Testar componente individual
npx ts-node AE0/event-stream/priority-queue.ts
npx ts-node AE0/event-stream/in-memory-buffer.ts
npx ts-node AE0/event-stream/event-bus.ts
```

---

## 📈 Performance

### Priority Queue
- **Inserção**: O(log n)
- **Remoção**: O(log n)
- **Peek**: O(1)
- **Espaço**: O(n)

### In-Memory Buffer
- **Inserção**: O(1)
- **Remoção**: O(1)
- **Espaço**: O(capacity)

### Event Bus
- **Publish**: O(log n) em fullstack, O(1) em lite
- **Subscribe**: O(1)
- **Dispatch**: O(m) onde m = número de handlers

---

## 🔧 Configuração Avançada

### Variáveis de Ambiente

```bash
# Capacidade do buffer (modo lite)
ARQOS_EVENT_BUFFER_LIMIT=1000

# Modo operacional (se não especificado explicitamente)
ARQOS_MODE=fullstack
```

### Event Bus Customizado

```typescript
import { createEventBus } from './event-bus';

// Criar instância local (não singleton)
const localBus = createEventBus({
  mode: 'fullstack',
  bufferLimit: 500,
  asyncHandlers: true,
  errorHandler: (error, event) => {
    // Custom error handling
    myLogger.error(`Event error: ${event.type}`, error);
  }
});
```

---

## 📝 Notas de Implementação

1. **Thread Safety**: Não implementado (execução single-threaded no Node.js)
2. **Persistência**: Não implementado (apenas in-memory)
3. **Backpressure**: Implementado via overflow strategies no buffer
4. **Error Handling**: Handlers não interrompem processamento de outros handlers
5. **Async Handlers**: Suportado com flag `asyncHandlers: true`

---

## 🎯 Próximos Passos

- [ ] Adicionar suporte a filtros avançados
- [ ] Implementar event replay
- [ ] Adicionar métricas de performance
- [ ] Suporte a event sourcing
- [ ] Persistência opcional em disco
- [ ] Rate limiting e throttling

---

## 📚 Referências

- **Min-Heap**: [Wikipedia](https://en.wikipedia.org/wiki/Heap_(data_structure))
- **Pub/Sub Pattern**: [Microsoft Docs](https://docs.microsoft.com/en-us/azure/architecture/patterns/publisher-subscriber)
- **Circular Buffer**: [Wikipedia](https://en.wikipedia.org/wiki/Circular_buffer)
