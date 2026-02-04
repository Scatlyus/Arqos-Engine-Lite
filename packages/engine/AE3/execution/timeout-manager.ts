export class TimeoutManager {
  async withTimeout<T>(timeoutMs: number, task: () => Promise<T>): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("timeout"));
      }, timeoutMs);

      task()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
