/**
 * In-Memory Buffer para AE0 Event Stream
 * Implementa um buffer circular com funcionalidades avançadas
 * Mantém compatibilidade com API original para uso legado
 */

import { PriorityEvent } from './priority-queue';

export interface BufferStats {
  size: number;
  capacity: number;
  utilizationPercent: number;
  isEmpty: boolean;
  isFull: boolean;
  totalPushed: number;
  totalPopped: number;
  totalOverflows: number;
}

export interface BufferOptions {
  capacity: number;
  overflowStrategy?: 'drop-oldest' | 'drop-newest' | 'reject';
  onOverflow?: (droppedItem: any) => void;
}

/**
 * Buffer circular em memória
 * Suporta múltiplas estratégias de overflow
 */
export class InMemoryBuffer<T = any> {
  private items: T[] = [];
  private readonly capacity: number;
  private readonly overflowStrategy: 'drop-oldest' | 'drop-newest' | 'reject';
  private readonly onOverflow?: (droppedItem: T) => void;

  // Estatísticas
  private totalPushed = 0;
  private totalPopped = 0;
  private totalOverflows = 0;

  constructor(limitOrOptions: number | BufferOptions) {
    if (typeof limitOrOptions === 'number') {
      // API legada
      this.capacity = limitOrOptions;
      this.overflowStrategy = 'drop-oldest';
    } else {
      // API nova
      this.capacity = limitOrOptions.capacity;
      this.overflowStrategy = limitOrOptions.overflowStrategy || 'drop-oldest';
      this.onOverflow = limitOrOptions.onOverflow;
    }
  }

  /**
   * Adiciona item ao buffer (API legada)
   */
  push(value: T): boolean {
    return this.add(value);
  }

  /**
   * Adiciona item ao buffer
   * @returns true se adicionado, false se rejeitado
   */
  add(value: T): boolean {
    if (this.capacity <= 0) {
      return false;
    }

    this.totalPushed++;

    if (this.items.length >= this.capacity) {
      this.totalOverflows++;

      switch (this.overflowStrategy) {
        case 'drop-oldest':
          const dropped = this.items.shift();
          if (dropped !== undefined && this.onOverflow) {
            this.onOverflow(dropped);
          }
          this.items.push(value);
          return true;

        case 'drop-newest':
          if (this.onOverflow) {
            this.onOverflow(value);
          }
          return false;

        case 'reject':
          if (this.onOverflow) {
            this.onOverflow(value);
          }
          this.totalPushed--; // Não foi realmente adicionado
          return false;
      }
    }

    this.items.push(value);
    return true;
  }

  /**
   * Remove e retorna o primeiro item (API legada)
   */
  shift(): T | undefined {
    return this.poll();
  }

  /**
   * Remove e retorna o primeiro item
   */
  poll(): T | undefined {
    const item = this.items.shift();
    if (item !== undefined) {
      this.totalPopped++;
    }
    return item;
  }

  /**
   * Retorna o primeiro item sem removê-lo
   */
  peek(): T | undefined {
    return this.items[0];
  }

  /**
   * Retorna o último item sem removê-lo
   */
  peekLast(): T | undefined {
    return this.items[this.items.length - 1];
  }

  /**
   * Remove todos os itens e retorna (API legada)
   */
  drain(): T[] {
    return this.drainAll();
  }

  /**
   * Remove todos os itens e retorna
   */
  drainAll(): T[] {
    const out = [...this.items];
    this.totalPopped += out.length;
    this.items = [];
    return out;
  }

  /**
   * Remove até N itens
   */
  drainN(count: number): T[] {
    const n = Math.min(count, this.items.length);
    const out = this.items.splice(0, n);
    this.totalPopped += out.length;
    return out;
  }

  /**
   * Retorna todos os itens sem removê-los
   */
  getAll(): T[] {
    return [...this.items];
  }

  /**
   * Limpa o buffer
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Retorna o tamanho atual
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Verifica se está vazio
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Verifica se está cheio
   */
  isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  /**
   * Retorna a capacidade total
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Retorna espaço disponível
   */
  getAvailableSpace(): number {
    return this.capacity - this.items.length;
  }

  /**
   * Remove itens que satisfazem o predicado
   */
  removeIf(predicate: (item: T) => boolean): number {
    const initialSize = this.items.length;
    this.items = this.items.filter(item => !predicate(item));
    const removed = initialSize - this.items.length;
    this.totalPopped += removed;
    return removed;
  }

  /**
   * Encontra item por predicado
   */
  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  /**
   * Encontra todos os itens que satisfazem o predicado
   */
  findAll(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  /**
   * Retorna estatísticas do buffer
   */
  getStats(): BufferStats {
    return {
      size: this.items.length,
      capacity: this.capacity,
      utilizationPercent: (this.items.length / this.capacity) * 100,
      isEmpty: this.isEmpty(),
      isFull: this.isFull(),
      totalPushed: this.totalPushed,
      totalPopped: this.totalPopped,
      totalOverflows: this.totalOverflows
    };
  }

  /**
   * Reseta as estatísticas
   */
  resetStats(): void {
    this.totalPushed = 0;
    this.totalPopped = 0;
    this.totalOverflows = 0;
  }
}

/**
 * Buffer especializado para eventos com prioridade
 */
export class EventBuffer<T = any> extends InMemoryBuffer<PriorityEvent<T>> {
  constructor(options: BufferOptions) {
    super(options);
  }

  /**
   * Encontra evento por ID
   */
  findById(id: string): PriorityEvent<T> | undefined {
    return this.find(event => event.id === id);
  }

  /**
   * Remove evento por ID
   */
  removeById(id: string): boolean {
    const removed = this.removeIf(event => event.id === id);
    return removed > 0;
  }

  /**
   * Retorna eventos por tipo
   */
  getByType(type: string): PriorityEvent<T>[] {
    return this.findAll(event => event.metadata?.type === type);
  }

  /**
   * Retorna eventos por source
   */
  getBySource(source: string): PriorityEvent<T>[] {
    return this.findAll(event => event.metadata?.source === source);
  }

  /**
   * Retorna eventos com prioridade maior ou igual
   */
  getByMinPriority(minPriority: number): PriorityEvent<T>[] {
    return this.findAll(event => event.priority <= minPriority);
  }

  /**
   * Remove eventos mais antigos que o timestamp
   */
  removeOlderThan(timestamp: number): number {
    return this.removeIf(event => event.timestamp < timestamp);
  }
}

// CLI para testes
if (require.main === module) {
  console.log('[AE0] Testando In-Memory Buffer...\n');

  // Teste 1: Buffer básico com drop-oldest
  console.log('=== Teste 1: Buffer com drop-oldest ===');
  const buffer1 = new InMemoryBuffer<string>({
    capacity: 3,
    overflowStrategy: 'drop-oldest',
    onOverflow: (item) => console.log(`  Overflow: dropped "${item}"`)
  });

  buffer1.add('A');
  buffer1.add('B');
  buffer1.add('C');
  console.log('Buffer:', buffer1.getAll());
  buffer1.add('D'); // Deve dropar 'A'
  console.log('Buffer após overflow:', buffer1.getAll());
  console.log('Stats:', buffer1.getStats());

  // Teste 2: Buffer com drop-newest
  console.log('\n=== Teste 2: Buffer com drop-newest ===');
  const buffer2 = new InMemoryBuffer<number>({
    capacity: 3,
    overflowStrategy: 'drop-newest'
  });

  buffer2.add(1);
  buffer2.add(2);
  buffer2.add(3);
  const added = buffer2.add(4); // Deve rejeitar
  console.log('Item 4 adicionado?', added);
  console.log('Buffer:', buffer2.getAll());

  // Teste 3: Event Buffer
  console.log('\n=== Teste 3: Event Buffer ===');
  const eventBuffer = new EventBuffer<string>({ capacity: 10 });

  eventBuffer.add({
    id: 'evt1',
    priority: 0,
    timestamp: Date.now(),
    data: 'Critical Event',
    metadata: { type: 'alert', source: 'AE2' }
  });

  eventBuffer.add({
    id: 'evt2',
    priority: 50,
    timestamp: Date.now(),
    data: 'Normal Event',
    metadata: { type: 'task', source: 'AE1' }
  });

  console.log('Total eventos:', eventBuffer.size());
  console.log('Eventos tipo alert:', eventBuffer.getByType('alert').length);
  console.log('Evento evt1:', eventBuffer.findById('evt1')?.data);

  console.log('\n[AE0] ✓ In-Memory Buffer testado com sucesso');
}
