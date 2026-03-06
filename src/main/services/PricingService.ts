import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import https from 'https'
import * as cheerio from 'cheerio'
import defaultPricing from '../../shared/pricing.json'

export interface ModelPricing {
  name: string
  input: number
  output: number
  cache_write: number
  cache_read: number
}

export interface PricingData {
  version: string
  source: string
  last_updated: string
  models: Record<string, ModelPricing>
  fallback_pricing: {
    opus: ModelPricing
    sonnet: ModelPricing
    haiku: ModelPricing
  }
  notes: Record<string, string>
}

const PRICING_URL = 'https://platform.claude.com/docs/en/docs/about-claude/pricing'

export class PricingService {
  private pricingData: PricingData | null = null
  private userPricingPath: string
  private updateInProgress = false

  constructor() {
    try {
      const userDataPath = app.getPath('userData')
      this.userPricingPath = path.join(userDataPath, 'pricing.json')
    } catch {
      // In unit tests or when app is not available, use temp directory
      this.userPricingPath = path.join('/tmp', 'claude-pricing.json')
    }
  }

  /**
   * Load pricing data from user's local file or fall back to bundled default
   */
  private loadPricingFromFile(): PricingData {
    try {
      // Try user's local file first
      if (fs.existsSync(this.userPricingPath)) {
        const data = fs.readFileSync(this.userPricingPath, 'utf-8')
        const parsed = JSON.parse(data) as PricingData
        if (this.validatePricingData(parsed)) {
          return parsed
        }
        console.warn('[PricingService] User pricing file failed sanity check, falling back to bundled default')
      }
    } catch (error) {
      console.warn('Failed to load user pricing file:', error)
    }

    // Fall back to bundled default (imported JSON)
    try {
      return defaultPricing as PricingData
    } catch (error) {
      console.error('Failed to load bundled pricing data:', error)
      // Return hardcoded fallback as last resort
      return this.getHardcodedFallback()
    }
  }

  /**
   * Validate that pricing data passes basic sanity checks.
   * For all Claude models, output price should always be > input price.
   */
  private validatePricingData(data: PricingData): boolean {
    if (!data.models || Object.keys(data.models).length === 0) return false
    for (const [key, model] of Object.entries(data.models)) {
      if (model.output < model.input) {
        console.warn(`[PricingService] Invalid pricing for ${key}: output ($${model.output}) < input ($${model.input})`)
        return false
      }
      if (model.cache_read > model.input) {
        console.warn(
          `[PricingService] Invalid pricing for ${key}: cache_read ($${model.cache_read}) > input ($${model.input})`
        )
        return false
      }
    }
    return true
  }

  /**
   * Get hardcoded fallback pricing (last resort)
   */
  private getHardcodedFallback(): PricingData {
    return {
      version: '2025-03-02-fallback',
      source: 'hardcoded-fallback',
      last_updated: new Date().toISOString(),
      models: {},
      fallback_pricing: {
        opus: { name: 'Claude Opus', input: 5.0, output: 25.0, cache_write: 6.25, cache_read: 0.5 },
        sonnet: { name: 'Claude Sonnet', input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 },
        haiku: { name: 'Claude Haiku', input: 1.0, output: 5.0, cache_write: 1.25, cache_read: 0.1 }
      },
      notes: {
        status: 'Using hardcoded fallback pricing - automatic update failed'
      }
    }
  }

  /**
   * Initialize pricing service - loads from file
   */
  async initialize(): Promise<void> {
    try {
      this.pricingData = this.loadPricingFromFile()
      console.log(`Pricing loaded: version ${this.pricingData.version}, updated ${this.pricingData.last_updated}`)
    } catch (error) {
      console.warn('Failed to initialize pricing, using hardcoded fallback:', error)
      this.pricingData = this.getHardcodedFallback()
    }
  }

  /**
   * Attempt to update pricing from official Anthropic website (non-blocking)
   */
  async updatePricingFromWeb(): Promise<{ success: boolean; error?: string }> {
    if (this.updateInProgress) {
      return { success: false, error: 'Update already in progress' }
    }

    this.updateInProgress = true

    try {
      console.log('Attempting to fetch latest pricing from Anthropic...')
      const html = await this.fetchPricingPage()
      const newPricing = this.parsePricingFromHTML(html)

      // Save to user's local file
      fs.writeFileSync(this.userPricingPath, JSON.stringify(newPricing, null, 2), 'utf-8')

      // Update in-memory pricing
      this.pricingData = newPricing

      console.log('✅ Pricing successfully updated from web')
      return { success: true }
    } catch (error) {
      console.warn('⚠️ Failed to update pricing from web, using cached version:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      this.updateInProgress = false
    }
  }

  /**
   * Fetch the pricing page HTML (follows redirects)
   */
  private fetchPricingPage(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Request timeout')), 15000)

      const makeRequest = (urlString: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          clearTimeout(timeout)
          reject(new Error('Too many redirects'))
          return
        }

        const urlObj = new URL(urlString)
        const protocol = urlObj.protocol === 'https:' ? https : require('http')

        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          headers: {
            'User-Agent': 'Claudia-App/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        }

        protocol
          .get(options, res => {
            // Handle redirects
            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
              const location = res.headers.location
              if (location) {
                const redirectUrl = location.startsWith('http')
                  ? location
                  : `${urlObj.protocol}//${urlObj.hostname}${location}`
                console.log(`Following redirect ${res.statusCode} to: ${redirectUrl}`)
                makeRequest(redirectUrl, redirectCount + 1)
                return
              }
            }

            if (res.statusCode !== 200) {
              clearTimeout(timeout)
              reject(new Error(`HTTP ${res.statusCode}`))
              return
            }

            let data = ''
            res.on('data', chunk => {
              data += chunk
            })

            res.on('end', () => {
              clearTimeout(timeout)
              resolve(data)
            })
          })
          .on('error', error => {
            clearTimeout(timeout)
            reject(error)
          })
      }

      makeRequest(PRICING_URL)
    })
  }

  /**
   * Parse pricing data from HTML table
   */
  private parsePricingFromHTML(html: string): PricingData {
    const $ = cheerio.load(html)
    const models: Record<string, ModelPricing> = {}

    // Find the pricing table
    const tables = $('table').toArray()
    const pricingEl = tables.find(t => {
      const text = $(t).text()
      return text.includes('Base Input Tokens') && text.includes('Output Tokens')
    })

    if (!pricingEl) {
      throw new Error('Pricing table not found in HTML')
    }

    const table = $(pricingEl)

    // Dynamically map column positions from header row
    const headerCells = table.find('thead th, thead td')
    const colMap: Record<string, number> = {}
    headerCells.each((i, cell) => {
      const text = $(cell).text().toLowerCase()
      if (text.includes('model')) colMap.model = i
      else if (text.includes('output')) colMap.output = i
      else if (text.includes('cache') && (text.includes('write') || text.includes('creation'))) colMap.cache_write = i
      else if (text.includes('cache') && (text.includes('read') || text.includes('hit'))) colMap.cache_read = i
      else if (text.includes('input') && !text.includes('cache')) colMap.input = i
    })

    // Fallback to legacy fixed positions if headers not found
    const modelCol = colMap.model ?? 0
    const inputCol = colMap.input ?? 1
    const cacheWriteCol = colMap.cache_write ?? 2
    const cacheReadCol = colMap.cache_read ?? 3
    const outputCol = colMap.output ?? 4

    // Parse table rows using dynamic column positions
    table.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 5) return

      const modelName = $(cells[modelCol]).text().trim()
      const inputPrice = this.extractPrice($(cells[inputCol]).text())
      const cacheWrite = this.extractPrice($(cells[cacheWriteCol]).text())
      const cacheRead = this.extractPrice($(cells[cacheReadCol]).text())
      const outputPrice = this.extractPrice($(cells[outputCol]).text())

      if (inputPrice && outputPrice && cacheWrite && cacheRead) {
        // Sanity check: output price should be > input price for all Claude models
        if (outputPrice < inputPrice) {
          console.warn(
            `[PricingService] Suspicious pricing for ${modelName}: output ($${outputPrice}) < input ($${inputPrice}), skipping`
          )
          return
        }
        const modelKey = this.normalizeModelName(modelName)
        models[modelKey] = {
          name: modelName,
          input: inputPrice,
          output: outputPrice,
          cache_write: cacheWrite,
          cache_read: cacheRead
        }
      }
    })

    return {
      version: new Date().toISOString().split('T')[0],
      source: PRICING_URL,
      last_updated: new Date().toISOString(),
      models,
      fallback_pricing: {
        opus: { name: 'Claude Opus', input: 5.0, output: 25.0, cache_write: 6.25, cache_read: 0.5 },
        sonnet: { name: 'Claude Sonnet', input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 },
        haiku: { name: 'Claude Haiku', input: 1.0, output: 5.0, cache_write: 1.25, cache_read: 0.1 }
      },
      notes: {
        units: 'All prices are in USD per million tokens (MTok)',
        auto_update: 'Updated automatically on app startup'
      }
    }
  }

  /**
   * Extract price from text like "$5 / MTok" -> 5.0
   */
  private extractPrice(text: string): number | null {
    const match = text.match(/\$?([\d.]+)\s*\/?\s*MTok/i)
    return match ? parseFloat(match[1]) : null
  }

  /**
   * Normalize model name to key format
   */
  private normalizeModelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9.-]/g, '')
      .replace(/\./g, '-')
  }

  /**
   * Get pricing for a specific model
   */
  getPricingForModel(modelId: string): ModelPricing {
    try {
      if (!this.pricingData) {
        this.pricingData = this.loadPricingFromFile()
      }

      // Try exact match first
      const exactMatch = this.pricingData.models[modelId]
      if (exactMatch) return exactMatch

      // Try partial match — prefer the longest matching key (most specific)
      const modelLower = modelId.toLowerCase()
      let bestMatch: ModelPricing | null = null
      let bestMatchLen = 0
      for (const [key, pricing] of Object.entries(this.pricingData.models)) {
        if (modelLower.includes(key) || key.includes(modelLower)) {
          if (key.length > bestMatchLen) {
            bestMatch = pricing
            bestMatchLen = key.length
          }
        }
      }
      if (bestMatch) return bestMatch

      // Fall back to model family
      if (modelLower.includes('opus')) {
        return { ...this.pricingData.fallback_pricing.opus }
      }
      if (modelLower.includes('haiku')) {
        return { ...this.pricingData.fallback_pricing.haiku }
      }
      // Default to sonnet
      return { ...this.pricingData.fallback_pricing.sonnet }
    } catch (error) {
      // Ultimate fallback if everything fails
      return { name: 'Claude Sonnet', input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 }
    }
  }

  /**
   * Calculate cost for a given usage
   */
  calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cacheCreationTokens: number = 0,
    cacheReadTokens: number = 0
  ): number {
    try {
      const pricing = this.getPricingForModel(modelId)

      const inputCost = (inputTokens / 1_000_000) * pricing.input
      const outputCost = (outputTokens / 1_000_000) * pricing.output
      const cacheWriteCost = (cacheCreationTokens / 1_000_000) * pricing.cache_write
      const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cache_read

      return inputCost + outputCost + cacheWriteCost + cacheReadCost
    } catch (error) {
      console.warn('Error calculating cost, using fallback:', error)
      // Fallback to simple calculation with Sonnet pricing
      return (
        (inputTokens / 1_000_000) * 3.0 +
        (outputTokens / 1_000_000) * 15.0 +
        (cacheCreationTokens / 1_000_000) * 3.75 +
        (cacheReadTokens / 1_000_000) * 0.3
      )
    }
  }

  /**
   * Get all available models and their pricing
   */
  getAllPricing(): PricingData {
    if (!this.pricingData) {
      this.pricingData = this.loadPricingFromFile()
    }
    return this.pricingData
  }

  /**
   * Check if pricing data is stale (older than 7 days)
   */
  isPricingStale(): boolean {
    if (!this.pricingData) return true

    const lastUpdate = new Date(this.pricingData.last_updated)
    const now = new Date()
    const daysDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)

    return daysDiff > 7
  }
}

// Singleton instance
let pricingServiceInstance: PricingService | null = null

export function getPricingService(): PricingService {
  if (!pricingServiceInstance) {
    pricingServiceInstance = new PricingService()
  }
  return pricingServiceInstance
}
