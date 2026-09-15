const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class RateLimiter{
    private calls: number[] = []
    private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly maxCalls: number,
    private readonly windowMs: number
  ) {
    if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new Error('maxCalls must be at least 1')
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be positive')
  }

  async waitForSlot(): Promise<void> {
    const slot = this.queue.then(async () => {
      const now = Date.now()
      this.calls = this.calls.filter((timestamp) => now - timestamp < this.windowMs)

      if (this.calls.length >= this.maxCalls) {
        const waitMs = this.calls[0] + this.windowMs - now
        console.warn(`[rate_limit] waiting ${waitMs}ms for a slot`)
        await sleep(Math.max(waitMs, 0))
        const afterWait = Date.now()
        this.calls = this.calls.filter((timestamp) => afterWait - timestamp < this.windowMs)
        this.calls.push(afterWait)
        return
      }

      this.calls.push(now)
    })

    this.queue = slot.catch(() => undefined)
    return slot
  }
}