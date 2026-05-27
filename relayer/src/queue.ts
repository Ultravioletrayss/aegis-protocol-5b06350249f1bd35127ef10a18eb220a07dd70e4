// ─── Intent Queue — collects AI intents, triggers batch at threshold ───

import { UserIntent } from "./types";

type BatchCallback = (batch: UserIntent[]) => Promise<void>;

export class IntentQueue {
  private queue: UserIntent[] = [];
  private batchSize: number;
  private onBatchReady: BatchCallback;
  private processing = false;

  constructor(batchSize: number, onBatchReady: BatchCallback) {
    this.batchSize = batchSize;
    this.onBatchReady = onBatchReady;
  }

  /** Add a single intent to the queue. Triggers batch if threshold reached. */
  enqueue(intent: UserIntent): number {
    this.queue.push(intent);
    const position = this.queue.length;
    console.log(`[Queue] Intent enqueued (#${position}/${this.batchSize}) — user=${intent.user.slice(0, 8)}… amount=${intent.amountIn}`);

    // Trigger batch processing asynchronously when threshold reached
    if (this.queue.length >= this.batchSize) {
      setImmediate(() => this.flush());
    }

    return position;
  }

  /** Force-flush the queue regardless of batch size */
  async flush(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    console.log(`\n[Queue] ⚡ Flushing batch of ${batch.length} intents…`);
    try {
      await this.onBatchReady(batch);
      console.log(`[Queue] ✅ Batch submitted successfully\n`);
    } catch (err: any) {
      console.error(`[Queue] ❌ Batch failed:`, err.message || err);
      // Re-enqueue failed intents at the front
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;
      // If more intents queued during processing, flush again
      if (this.queue.length >= this.batchSize) {
        setImmediate(() => this.flush());
      }
    }
  }

  /** Get current queue snapshot */
  getSnapshot() {
    return {
      currentSize: this.queue.length,
      batchSize: this.batchSize,
      progress: `${this.queue.length}/${this.batchSize}`,
      intents: this.queue.map((intent, i) => ({
        index: i,
        action: intent.action,
        agentId: intent.agentId,
        user: intent.user,
        tokenIn: intent.tokenIn,
        amountIn: intent.amountIn,
      })),
    };
  }
}
