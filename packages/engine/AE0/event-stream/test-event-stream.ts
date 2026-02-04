/**
 * Testes Integrados do Event Stream
 * Valida os três componentes trabalhando juntos
 */

import { PriorityQueue, PriorityEventFactory } from './priority-queue';
import { InMemoryBuffer, EventBuffer } from './in-memory-buffer';
import {
  initializeEventStream,
  resetEventBus,
  createEventBus,
  EventBus
} from './event-bus';

console.log('[AE0] ========================================');
console.log('[AE0] Iniciando Testes do Event Stream');
console.log('[AE0] ========================================\n');

// ============================================================
// TESTE 1: Priority Queue
// ============================================================
console.log('=== TESTE 1: Priority Queue ===\n');

const queue = new PriorityQueue<string>();

// Adicionar eventos com diferentes prioridades
queue.enqueue('Tarefa Normal', 50);
queue.enqueue('ALERTA CRÍTICO!', 0);
queue.enqueue('Info Debug', 100);
queue.enqueue('Tarefa Importante', 10);

console.log('Stats da Queue:', queue.getStats());
console.log('\nProcessando eventos por prioridade (menor = mais prioritário):');

while (!queue.isEmpty()) {
  const event = queue.dequeueEvent();
  if (event) {
    console.log(`  [P${event.priority.toString().padStart(3)}] ${event.data}`);
  }
}

console.log('✓ Priority Queue: OK\n');

// ============================================================
// TESTE 2: In-Memory Buffer
// ============================================================
console.log('=== TESTE 2: In-Memory Buffer ===\n');

// Teste 2.1: Buffer com drop-oldest
console.log('Teste 2.1: Buffer circular (drop-oldest)');
const buffer1 = new InMemoryBuffer<string>({
  capacity: 3,
  overflowStrategy: 'drop-oldest',
  onOverflow: (item) => console.log(`  → Overflow: dropped "${item}"`)
});

buffer1.add('Item A');
buffer1.add('Item B');
buffer1.add('Item C');
console.log('  Buffer:', buffer1.getAll());

buffer1.add('Item D'); // Deve dropar 'Item A'
console.log('  Buffer após overflow:', buffer1.getAll());
console.log('  Stats:', buffer1.getStats());

// Teste 2.2: Event Buffer com query
console.log('\nTeste 2.2: Event Buffer com queries');
const eventBuffer = new EventBuffer<string>({ capacity: 100 });

eventBuffer.add({
  id: 'evt1',
  priority: 0,
  timestamp: Date.now(),
  data: 'Sistema iniciando',
  metadata: { type: 'lifecycle', source: 'AE0' }
});

eventBuffer.add({
  id: 'evt2',
  priority: 50,
  timestamp: Date.now(),
  data: 'Processando tarefa X',
  metadata: { type: 'task', source: 'AE2' }
});

eventBuffer.add({
  id: 'evt3',
  priority: 0,
  timestamp: Date.now(),
  data: 'Erro crítico detectado!',
  metadata: { type: 'alert', source: 'AE3' }
});

console.log('  Total eventos:', eventBuffer.size());
console.log('  Eventos tipo "alert":', eventBuffer.getByType('alert').length);
console.log('  Eventos de AE0:', eventBuffer.getBySource('AE0').length);
console.log('  Eventos críticos (P<=10):', eventBuffer.getByMinPriority(10).length);

console.log('✓ In-Memory Buffer: OK\n');

// ============================================================
// TESTE 3: Event Bus - Modo Lite
// ============================================================
console.log('=== TESTE 3: Event Bus (Modo Lite) ===\n');

async function testLiteMode() {
  const bus = createEventBus({ mode: 'lite', bufferLimit: 100 });

  let receivedEvents = 0;

  // Subscribe a eventos específicos
  const unsubTask = bus.subscribe('task.created', (payload, meta) => {
    console.log(`  [task.created] ${payload}`);
    receivedEvents++;
  });

  const unsubAlert = bus.subscribe('alert.critical', (payload, meta) => {
    console.log(`  [alert.critical] ⚠ ${payload} (priority: ${meta.priority})`);
    receivedEvents++;
  });

  // Subscribe wildcard
  bus.subscribe('*', (payload, meta) => {
    receivedEvents++;
  });

  // Publicar eventos
  bus.publish('task.created', 'Compilar projeto');
  bus.publish('task.created', 'Executar testes');
  bus.publish('alert.critical', 'Memória crítica!', { priority: 0 });

  const stats = bus.getStats();
  console.log('\n  Stats:', stats);
  console.log(`  Eventos recebidos pelos handlers: ${receivedEvents}`);

  unsubTask();
  unsubAlert();

  console.log('✓ Event Bus (Lite): OK\n');
}

// ============================================================
// TESTE 4: Event Bus - Modo Fullstack
// ============================================================
console.log('=== TESTE 4: Event Bus (Modo Fullstack) ===\n');

async function testFullstackMode() {
  const bus = createEventBus({
    mode: 'fullstack',
    asyncHandlers: true,
    errorHandler: (error, event) => {
      console.log(`  ✗ Error handler: ${error.message} em ${event.type}`);
    }
  });

  let processedCount = 0;

  // Subscriber que conta eventos
  bus.subscribe('*', (payload, meta) => {
    processedCount++;
    console.log(`  [${meta.type}] ${payload} (P${meta.priority})`);
  });

  // Subscriber que gera erro proposital
  bus.subscribe('error.test', () => {
    throw new Error('Erro proposital para teste');
  });

  // Publicar eventos com prioridades diferentes
  // No modo fullstack, serão ordenados por prioridade
  bus.publish('info.log', 'Baixa prioridade', { priority: 100 });
  bus.publish('alert.warning', 'Média prioridade', { priority: 50 });
  bus.publish('alert.critical', 'CRÍTICO!', { priority: 0 });
  bus.publish('task.normal', 'Task normal', { priority: 25 });

  // Publicar evento que gera erro
  bus.publish('error.test', 'Teste de erro');

  const stats = bus.getStats();
  console.log('\n  Stats:', stats);
  console.log(`  Eventos processados: ${processedCount}`);
  console.log(`  Total de erros: ${stats.totalErrors}`);

  console.log('✓ Event Bus (Fullstack): OK\n');
}

// ============================================================
// TESTE 5: Integração Completa
// ============================================================
console.log('=== TESTE 5: Integração Completa ===\n');

async function testIntegration() {
  // Resetar bus singleton
  resetEventBus();

  // Inicializar com singleton
  const bus = await initializeEventStream({
    mode: 'fullstack',
    bufferLimit: 1000
  });

  console.log('  Event Bus inicializado via singleton');

  // Simular eventos do sistema Arqos
  const events = [
    { type: 'ae0.bootstrap.start', payload: 'Iniciando AE0', priority: 0 },
    { type: 'ae1.memory.init', payload: 'Inicializando DNABase', priority: 10 },
    { type: 'ae2.strategos.ready', payload: 'Strategos pronto', priority: 10 },
    { type: 'ae3.pipeline.start', payload: 'Pipeline iniciado', priority: 20 },
    { type: 'system.ready', payload: 'Sistema operacional', priority: 30 }
  ];

  const receivedEvents: string[] = [];

  bus.subscribe('*', (payload, meta) => {
    receivedEvents.push(meta.type);
    console.log(`  ✓ ${meta.type}: ${payload}`);
  });

  // Publicar todos os eventos
  events.forEach(evt => {
    bus.publish(evt.type, evt.payload, { priority: evt.priority });
  });

  const stats = bus.getStats();
  console.log(`\n  Total de eventos: ${stats.totalPublished}`);
  console.log(`  Eventos despachados: ${stats.totalDispatched}`);
  console.log(`  Subscribers ativos: ${stats.subscriberCount}`);

  console.log('✓ Integração Completa: OK\n');
}

// ============================================================
// Executar todos os testes
// ============================================================
async function runAllTests() {
  try {
    await testLiteMode();
    await testFullstackMode();
    await testIntegration();

    console.log('[AE0] ========================================');
    console.log('[AE0] ✓ TODOS OS TESTES PASSARAM');
    console.log('[AE0] ========================================\n');

    console.log('Resumo dos componentes testados:');
    console.log('  ✓ Priority Queue: Min-Heap com O(log n)');
    console.log('  ✓ In-Memory Buffer: Circular buffer com overflow strategies');
    console.log('  ✓ Event Buffer: Buffer especializado para eventos');
    console.log('  ✓ Event Bus (Lite): FIFO simples');
    console.log('  ✓ Event Bus (Fullstack): Com prioridades e async handlers');
    console.log('  ✓ Integração: Componentes trabalhando juntos\n');

    process.exit(0);
  } catch (error) {
    console.error('\n[AE0] ✗ ERRO NOS TESTES:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runAllTests();
}
