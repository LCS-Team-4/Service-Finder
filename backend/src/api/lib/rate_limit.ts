const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class RateLimiter{
    private calls :number[]=[ ]

  constructor(
    private readonly maxCalls: number,
    private readonly windowMs: number
  ) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now()
    this.calls = this.calls.filter((t) => now - t < this.windowMs)

    if (this.calls.length >= this.maxCalls) {
      const waitMs = this.calls[0] + this.windowMs - now
      console.warn(`[rate_limit] waiting ${waitMs}ms for a slot`)
      await sleep(Math.max(waitMs, 0))
      return this.waitForSlot()
    }

    this.calls.push(now)
  }
}