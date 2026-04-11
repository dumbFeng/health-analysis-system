type QueueTask<T> = {
  id: string;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class TaskQueue {
  private readonly tasks: QueueTask<unknown>[] = [];
  private readonly taskIds = new Set<string>();
  private running = 0;

  constructor(
    private readonly name: string,
    private readonly concurrency: number,
    private readonly cap: number,
  ) {}

  get size() {
    return this.tasks.length;
  }

  get active() {
    return this.running;
  }

  get totalInFlight() {
    return this.running + this.tasks.length;
  }

  isFull() {
    return this.totalInFlight >= this.cap;
  }

  getStats() {
    return {
      name: this.name,
      concurrency: this.concurrency,
      cap: this.cap,
      active: this.running,
      queued: this.tasks.length,
      totalInFlight: this.totalInFlight,
    };
  }

  hasTask(id: string) {
    return this.taskIds.has(id);
  }

  enqueue<T>(id: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.taskIds.add(id);
      this.tasks.push({
        id,
        run,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  private pump() {
    while (this.running < this.concurrency && this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) {
        return;
      }

      this.running += 1;
      void task
        .run()
        .then((result) => {
          task.resolve(result);
        })
        .catch((error) => {
          task.reject(error);
        })
        .finally(() => {
          this.running -= 1;
          this.taskIds.delete(task.id);
          this.pump();
        });
    }
  }
}
