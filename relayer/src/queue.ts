// ─── Intent Queue — collects AI intents, triggers batch at threshold ───

import { UserIntent } from "./types";

type BatchCallback = (batch: UserIntent[]) => Promise<void>;

export class IntentQueue {
  private queue: UserIntent[] = [];
  private batchSize: number;
  private onBatchReady: BatchCallback;
  private processing = false;
  
  // === 🎲 方案 C：随机 batch size（演示用 · 让打包数量有波动） ===
  // 生产环境请删除 MIN/MAX_BATCH_SIZE，固定使用 this.batchSize
  private readonly MIN_BATCH_SIZE = 8;
  private readonly MAX_BATCH_SIZE = 12;
  private lastFlushTime = Date.now();
  // =====================================================================

  constructor(batchSize: number, onBatchReady: BatchCallback) {
    this.batchSize = batchSize;
    this.onBatchReady = onBatchReady;
  }

  /** Add a single intent to the queue. Triggers batch if threshold reached. */
  enqueue(intent: UserIntent): number {
    this.queue.push(intent);
    const position = this.queue.length;
    console.log(`[Queue] Intent enqueued (#${position}) — user=${intent.user.slice(0, 8)}… amount=${intent.amountIn}`);

    // Trigger batch processing asynchronously when threshold reached
    if (this.shouldFlush()) {
      setImmediate(() => this.flush());
    }

    return position;
  }

  // === 🎲 方案 C：动态判断是否应该打包 ===
  private shouldFlush(): boolean {
    // 如果正在处理中，不重复触发
    if (this.processing) return false;
    if (this.queue.length === 0) return false;
    
    // 计算本次的目标 batch size（8~12 随机）
    const timeFactor = Date.now() % 1000;
    const randomFactor = Math.floor(Math.random() * 1000);
    const targetSize = this.MIN_BATCH_SIZE + 
      ((timeFactor + randomFactor) % (this.MAX_BATCH_SIZE - this.MIN_BATCH_SIZE + 1));
    
    // 条件1：队列达到目标大小 → 打包
    if (this.queue.length >= targetSize) {
      console.log(`[Queue] 🎯 Target reached (${this.queue.length} >= ${targetSize}), triggering flush`);
      return true;
    }
    
    // 条件2：超时保护（至少 5 个且超过 5 秒没打包）→ 强制打包，避免小意图一直等
    const isTimeout = this.queue.length >= 5 && (Date.now() - this.lastFlushTime) > 5000;
    if (isTimeout) {
      console.log(`[Queue] ⏰ Timeout flush (${this.queue.length} intents, waiting >5s)`);
      return true;
    }
    
    return false;
  }
  // =====================================

  /** Force-flush the queue regardless of batch size */
  async flush(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    this.lastFlushTime = Date.now();
    
    // 🔥 方案 C：实际打包数量 = 当前队列长度（可能 8~12 个）
    // 不再固定取 this.batchSize，让 AgentExecutor 收到不同长度的 batch
    const batchSize = Math.min(this.queue.length, this.MAX_BATCH_SIZE);
    const batch = this.queue.splice(0, batchSize);

    console.log(`\n[Queue] ⚡ Flushing batch of ${batch.length} intents (target: ${this.MIN_BATCH_SIZE}-${this.MAX_BATCH_SIZE})…`);
    try {
      await this.onBatchReady(batch);
      console.log(`[Queue] ✅ Batch submitted successfully\n`);
    } catch (err: any) {
      console.error(`[Queue] ❌ Batch failed:`, err.message || err);
      // Re-enqueue failed intents at the front
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;
      // If more intents queued during processing, check again
      if (this.shouldFlush()) {
        setImmediate(() => this.flush());
      }
    }
  }

  /** Get current queue snapshot */
  getSnapshot() {
    // 计算当前目标 size（用于前端进度条显示）
    const timeFactor = Date.now() % 1000;
    const randomFactor = Math.floor(Math.random() * 1000);
    const targetSize = this.MIN_BATCH_SIZE + 
      ((timeFactor + randomFactor) % (this.MAX_BATCH_SIZE - this.MIN_BATCH_SIZE + 1));
    
    return {
      currentSize: this.queue.length,
      batchSize: `${this.MIN_BATCH_SIZE}-${this.MAX_BATCH_SIZE}`, // 显示范围
      targetSize: targetSize, // 当前随机目标
      progress: `${this.queue.length}/${targetSize}`,
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
