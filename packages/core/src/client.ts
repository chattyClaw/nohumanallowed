/**
 * Client-side challenge solver for No Human Allowed
 * 
 * This module is designed to run in browsers or Node.js agents
 */

// F-08 FIX: Use static ESM import for Node.js crypto
import { createHash } from 'crypto'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const window: any
declare const navigator: any

export interface SolveOptions {
  /** The challenge prefix */
  prefix: string
  /** The target pattern (e.g., "0000") */
  target: string
  /** Maximum iterations before giving up. Default: 10_000_000 */
  maxIterations?: number
  /** Callback for progress updates */
  onProgress?: (iterations: number, hashRate: number) => void
  /** Progress update interval in iterations. Default: 100_000 */
  progressInterval?: number
}

export interface SolveResult {
  /** Whether a solution was found */
  found: boolean
  /** The nonce that solves the challenge (if found) */
  nonce?: string
  /** Number of iterations tried */
  iterations: number
  /** Time taken in milliseconds */
  timeMs: number
  /** Hash rate (hashes per second), 0 if timeMs is 0 */
  hashRate: number
  /** The resulting hash (if found) */
  hash?: string
}

/**
 * Calculate hash rate safely (guards against division by zero)
 */
function calculateHashRate(iterations: number, timeMs: number): number {
  if (timeMs <= 0) return 0
  return Math.round((iterations / timeMs) * 1000)
}

/**
 * Compute SHA-256 hash using Web Crypto API (browser) or Node crypto
 */
async function sha256Async(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser environment - use Web Crypto API
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } else {
    // Node.js environment - use crypto module
    return createHash('sha256').update(message).digest('hex')
  }
}

/**
 * Synchronous SHA-256 for Node.js (faster for brute force)
 * F-08 FIX: Uses static import instead of require()
 */
function sha256Sync(message: string): string {
  return createHash('sha256').update(message).digest('hex')
}

/**
 * Solve a No Human Allowed challenge
 * 
 * Finds a nonce such that SHA256(prefix + nonce) starts with target
 */
export async function solveChallenge(options: SolveOptions): Promise<SolveResult> {
  const {
    prefix,
    target,
    maxIterations = 10_000_000,
    onProgress,
    progressInterval = 100_000,
  } = options

  const startTime = Date.now()
  let iterations = 0

  // Check if we're in Node.js for sync hashing (much faster)
  const isNode = typeof window === 'undefined'

  for (let nonce = 0; nonce < maxIterations; nonce++) {
    iterations++
    const nonceStr = nonce.toString()
    
    let hash: string
    if (isNode) {
      hash = sha256Sync(`${prefix}${nonceStr}`)
    } else {
      hash = await sha256Async(`${prefix}${nonceStr}`)
    }

    if (hash.startsWith(target)) {
      const timeMs = Date.now() - startTime
      return {
        found: true,
        nonce: nonceStr,
        iterations,
        timeMs,
        hashRate: calculateHashRate(iterations, timeMs),
        hash,
      }
    }

    // Progress callback
    if (onProgress && iterations % progressInterval === 0) {
      const timeMs = Date.now() - startTime
      onProgress(iterations, calculateHashRate(iterations, timeMs))
    }
  }

  const timeMs = Date.now() - startTime
  return {
    found: false,
    iterations,
    timeMs,
    hashRate: calculateHashRate(iterations, timeMs),
  }
}

/**
 * Solve challenge using Web Workers (browser only)
 * Distributes work across multiple cores for faster solving
 * 
 * @experimental This function is a stub and currently falls back to single-threaded.
 * The numWorkers parameter is ignored. Use solveChallenge() directly for now.
 */
export async function solveChallengeParallel(
  options: SolveOptions,
  numWorkers: number = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined) || 4
): Promise<SolveResult> {
  void numWorkers // Suppress unused variable warning
  return solveChallenge(options)
}

/**
 * Estimate time to solve based on difficulty
 */
export function estimateSolveTime(difficulty: number): {
  averageMs: number
  description: string
} {
  // Average iterations = 16^difficulty / 2
  const avgIterations = Math.pow(16, difficulty) / 2
  // Realistic hash rates: ~300k/sec browser, ~800k/sec Node (measured benchmarks)
  const hashRate = typeof window === 'undefined' ? 800_000 : 300_000
  const averageMs = (avgIterations / hashRate) * 1000

  let description: string
  if (averageMs < 100) description = 'Nearly instant'
  else if (averageMs < 1000) description = 'Under a second'
  else if (averageMs < 10000) description = 'A few seconds'
  else if (averageMs < 60000) description = 'Under a minute'
  else description = 'Over a minute'

  return { averageMs, description }
}
