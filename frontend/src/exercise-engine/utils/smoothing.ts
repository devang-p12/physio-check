export class MovingAverageFilter {
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
  }

  push(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    return this.current;
  }

  get current(): number {
    if (this.buffer.length === 0) return 0;
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
  }

  reset(): void {
    this.buffer = [];
  }
}

