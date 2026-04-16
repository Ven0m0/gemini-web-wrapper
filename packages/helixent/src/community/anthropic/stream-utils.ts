export class StreamAccumulator {
  push(event: any): void {}
  snapshot(): any { return { role: "assistant", content: [], streaming: true }; }
}
