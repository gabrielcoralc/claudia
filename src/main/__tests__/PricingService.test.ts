import { describe, it, expect, beforeEach } from 'vitest'
import { PricingService } from '../services/PricingService'

// PricingService loads bundled pricing.json by default when no user file exists.
// Tests exercise the public API: getPricingForModel, calculateCost.

describe('PricingService — model matching', () => {
  let service: PricingService

  beforeEach(async () => {
    service = new PricingService()
    await service.initialize()
  })

  // ── Exact key match ───────────────────────────────────────────────────────

  it('matches an exact key from bundled pricing', () => {
    const pricing = service.getPricingForModel('claude-sonnet-4-5')
    expect(pricing.input).toBe(3.0)
    expect(pricing.output).toBe(15.0)
  })

  // ── Partial match (real API model IDs include date suffix) ─────────────────

  it('matches claude-sonnet-4-5-20250929 to claude-sonnet-4-5 pricing', () => {
    const pricing = service.getPricingForModel('claude-sonnet-4-5-20250929')
    expect(pricing.input).toBe(3.0)
    expect(pricing.output).toBe(15.0)
    expect(pricing.cache_write).toBe(3.75)
    expect(pricing.cache_read).toBe(0.3)
  })

  it('matches claude-opus-4-5-20250929 to claude-opus-4-5 pricing', () => {
    const pricing = service.getPricingForModel('claude-opus-4-5-20250929')
    expect(pricing.input).toBe(5.0)
    expect(pricing.output).toBe(25.0)
  })

  it('matches claude-haiku-4-5-20250929 to claude-haiku-4-5 pricing', () => {
    const pricing = service.getPricingForModel('claude-haiku-4-5-20250929')
    expect(pricing.input).toBe(1.0)
    expect(pricing.output).toBe(5.0)
  })

  // ── Longest match wins (specificity) ──────────────────────────────────────

  it('prefers claude-sonnet-4-5 over claude-sonnet-4 for model claude-sonnet-4-5-20250929', () => {
    // Both keys would partially match; the longer one (4-5) should win
    const pricing = service.getPricingForModel('claude-sonnet-4-5-20250929')
    expect(pricing.name).toBe('Claude Sonnet 4.5')
  })

  it('matches claude-sonnet-4-20250929 to claude-sonnet-4 (not 4-5)', () => {
    const pricing = service.getPricingForModel('claude-sonnet-4-20250929')
    expect(pricing.name).toBe('Claude Sonnet 4')
  })

  it('prefers claude-opus-4-5 over claude-opus-4 for model claude-opus-4-5-20250929', () => {
    const pricing = service.getPricingForModel('claude-opus-4-5-20250929')
    expect(pricing.name).toBe('Claude Opus 4.5')
  })

  // ── Family fallback ───────────────────────────────────────────────────────

  it('falls back to opus family for an unknown opus model', () => {
    const pricing = service.getPricingForModel('claude-opus-99-20260101')
    // Should match via family fallback since no key "claude-opus-99" exists
    expect(pricing.input).toBeGreaterThanOrEqual(5.0)
  })

  it('falls back to sonnet family for a completely unknown model', () => {
    const pricing = service.getPricingForModel('claude-unknown-model-20260101')
    // Default fallback is sonnet
    expect(pricing.input).toBe(3.0)
    expect(pricing.output).toBe(15.0)
  })

  it('falls back to haiku family for an unknown haiku model', () => {
    const pricing = service.getPricingForModel('claude-haiku-99-20260101')
    expect(pricing.input).toBeGreaterThanOrEqual(0.25)
    expect(pricing.input).toBeLessThanOrEqual(1.0)
  })
})

describe('PricingService — calculateCost', () => {
  let service: PricingService

  beforeEach(async () => {
    service = new PricingService()
    await service.initialize()
  })

  it('calculates cost for sonnet with all token types', () => {
    // 1M input tokens @ $3, 1M output @ $15, 1M cache write @ $3.75, 1M cache read @ $0.30
    const cost = service.calculateCost('claude-sonnet-4-5-20250929', 1_000_000, 1_000_000, 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(3.0 + 15.0 + 3.75 + 0.3, 2)
  })

  it('calculates cost correctly for small token counts', () => {
    // 100 input + 50 output on sonnet
    const cost = service.calculateCost('claude-sonnet-4-5-20250929', 100, 50, 0, 0)
    const expected = (100 / 1_000_000) * 3.0 + (50 / 1_000_000) * 15.0
    expect(cost).toBeCloseTo(expected, 8)
  })

  it('returns 0 for zero tokens', () => {
    const cost = service.calculateCost('claude-sonnet-4-5-20250929', 0, 0, 0, 0)
    expect(cost).toBe(0)
  })

  it('uses correct pricing for opus model', () => {
    // 1M input @ $5, 1M output @ $25
    const cost = service.calculateCost('claude-opus-4-5-20250929', 1_000_000, 1_000_000, 0, 0)
    expect(cost).toBeCloseTo(5.0 + 25.0, 2)
  })

  it('uses correct pricing for haiku model', () => {
    // 1M input @ $1, 1M output @ $5
    const cost = service.calculateCost('claude-haiku-4-5-20250929', 1_000_000, 1_000_000, 0, 0)
    expect(cost).toBeCloseTo(1.0 + 5.0, 2)
  })
})
