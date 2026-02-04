/**
 * Priority Queue para AE0 Event Stream
 * Implementa uma fila de prioridade baseada em Min-Heap para ordenação de eventos
 * Complexidade: O(log n) para insert/extract, O(1) para peek
 */

export interface PriorityEvent<T = any> {
  id: string;
  priority: number; // Menor valor = maior prioridade
  timestamp: number;
  data: T;
  metadata?: {
    source?: string;
    type?: string;
    [key: string]: any;
  };
}

/**
 * Priority Queue usando Min-Heap
 * Mantém compatibilidade com API original para uso legado
 */
export class PriorityQueue<T = any> {
  private heap: PriorityEvent<T>[] = [];
  private idCounter = 0;

  /**
   * Insere um evento na fila (API legada)
   * @param value - Valor do evento
   * @param priority - Prioridade (menor = mais prioritário)
   */
  enqueue(value: T, priority: number = 50): void {
    const event: PriorityEvent<T> = {
      id: `evt_${Date.now()}_${++this.idCounter}`,
      priority,
      timestamp: Date.now(),
      data: value
    };
    this.enqueueEvent(event);
  }

  /**
   * Insere um evento completo na fila
   */
  enqueueEvent(event: PriorityEvent<T>): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove e retorna o evento de maior prioridade
   */
  dequeue(): T | undefined {
    const event = this.dequeueEvent();
    return event?.data;
  }

  /**
   * Remove e retorna o evento completo de maior prioridade
   */
  dequeueEvent(): PriorityEvent<T> | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    if (this.heap.length === 1) {
      return this.heap.pop();
    }

    const root = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);

    return root;
  }

  /**
   * Retorna o próximo valor sem removê-lo
   */
  peek(): T | undefined {
    return this.heap[0]?.data;
  }

  /**
   * Retorna o próximo evento completo sem removê-lo
   */
  peekEvent(): PriorityEvent<T> | undefined {
    return this.heap[0];
  }

  /**
   * Retorna o tamanho da fila
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Verifica se a fila está vazia
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Limpa a fila
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Retorna todos os eventos (não ordenados)
   */
  toArray(): PriorityEvent<T>[] {
    return [...this.heap];
  }

  /**
   * Remove eventos que satisfazem o predicado
   */
  removeIf(predicate: (event: PriorityEvent<T>) => boolean): number {
    const initialSize = this.heap.length;
    this.heap = this.heap.filter(event => !predicate(event));

    if (this.heap.length > 0 && this.heap.length !== initialSize) {
      this.heapify();
    }

    return initialSize - this.heap.length;
  }

  /**
   * Encontra evento por ID
   */
  findById(id: string): PriorityEvent<T> | undefined {
    return this.heap.find(event => event.id === id);
  }

  /**
   * Atualiza a prioridade de um evento
   */
  updatePriority(id: string, newPriority: number): boolean {
    const index = this.heap.findIndex(event => event.id === id);

    if (index === -1) {
      return false;
    }

    const oldPriority = this.heap[index].priority;
    this.heap[index].priority = newPriority;

    if (newPriority < oldPriority) {
      this.bubbleUp(index);
    } else if (newPriority > oldPriority) {
      this.bubbleDown(index);
    }

    return true;
  }

  /**
   * Retorna estatísticas da fila
   */
  getStats(): {
    size: number;
    isEmpty: boolean;
    highestPriority?: number;
    lowestPriority?: number;
    averagePriority?: number;
  } {
    if (this.isEmpty()) {
      return { size: 0, isEmpty: true };
    }

    const priorities = this.heap.map(e => e.priority);
    const min = Math.min(...priorities);
    const max = Math.max(...priorities);
    const avg = priorities.reduce((a, b) => a + b, 0) / priorities.length;

    return {
      size: this.size(),
      isEmpty: false,
      highestPriority: min,
      lowestPriority: max,
      averagePriority: avg
    };
  }

  // ========== Heap Operations ==========

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) {
        break;
      }

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < this.heap.length &&
        this.compare(this.heap[leftChild], this.heap[smallest]) < 0
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.compare(this.heap[rightChild], this.heap[smallest]) < 0
      ) {
        smallest = rightChild;
      }

      if (smallest === index) {
        break;
      }

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  private compare(a: PriorityEvent<T>, b: PriorityEvent<T>): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.timestamp - b.timestamp; // FIFO em empate
  }

  private heapify(): void {
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }
}

/**
 * Factory para criar eventos com prioridade
 */
export class PriorityEventFactory {
  private static counter = 0;

  static create<T>(
    data: T,
    priority: number,
    metadata?: PriorityEvent<T>['metadata']
  ): PriorityEvent<T> {
    return {
      id: `evt_${Date.now()}_${++this.counter}`,
      priority,
      timestamp: Date.now(),
      data,
      metadata
    };
  }

  static createHigh<T>(
    data: T,
    metadata?: PriorityEvent<T>['metadata']
  ): PriorityEvent<T> {
    return this.create(data, 0, metadata);
  }

  static createMedium<T>(
    data: T,
    metadata?: PriorityEvent<T>['metadata']
  ): PriorityEvent<T> {
    return this.create(data, 25, metadata);
  }

  static createLow<T>(
    data: T,
    metadata?: PriorityEvent<T>['metadata']
  ): PriorityEvent<T> {
    return this.create(data, 75, metadata);
  }

  static resetCounter(): void {
    this.counter = 0;
  }
}

// CLI para testes
if (require.main === module) {
  console.log('[AE0] Testando Priority Queue...\n');

  const queue = new PriorityQueue<string>();

  // Teste API legada
  queue.enqueue('Task Normal', 50);
  queue.enqueue('Alerta Crítico', 0);
  queue.enqueue('Info', 75);

  // Teste API nova
  queue.enqueueEvent(PriorityEventFactory.createMedium('Task Média'));

  console.log('Stats:', queue.getStats());
  console.log('\nProcessando eventos por prioridade:');

  while (!queue.isEmpty()) {
    const event = queue.dequeueEvent()!;
    console.log(`[P${event.priority}] ${event.data} (ID: ${event.id})`);
  }

  console.log('\n[AE0] ✓ Priority Queue testada com sucesso');
}
