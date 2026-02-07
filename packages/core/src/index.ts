import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

export interface ChallengeOptions {
  /** Number of leading zeros required (1-6). Default: 4 */
  difficulty?: number
  /** Seconds until challenge expires (must be positive). Default: 60 */
  expiresIn?: number
  /** Optional metadata to embed in challenge */
  metadata?: Record<string, unknown>
  /** Secret key for signing (recommended: 32+ chars). Adds tamper protection. */
  secret?: string
}

export interface Challenge {
  /** Unique challenge ID */
  id: string
  /** Random prefix to hash with nonce */
  prefix: string
  /** Target pattern (leading zeros, 1-6 chars) */
  target: string
  /** Unix timestamp when challenge expires */
  expiresAt: number
  /** Optional embedded metadata */
  metadata?: Record<string, unknown>
  /** HMAC signature for tamper protection (128-bit) */
  signature?: string
}

export interface VerifyOptions {
  /** The original challenge prefix */
  prefix: string
  /** The nonce submitted by the client */
  nonce: string
  /** The target pattern to match (1-6 zeros) */
  target: string
  /** When the challenge expires */
  expiresAt: number
  /** Signature to verify (if challenge was signed) */
  signature?: string
  /** Secret used to sign (required if signature present) */
  secret?: string
  /** If true, reject challenges without valid signatures (requires secret) */
  requireSignature?: boolean
  /** Optional metadata (must match if included in signature) */
  metadata?: Record<string, unknown>
}

export interface VerifyResult {
  /** Whether the solution is valid */
  valid: boolean
  /** Reason for failure (if invalid) */
  reason?: 'expired' | 'invalid_hash' | 'invalid_signature' | 'missing_signature' | 'missing_secret' | 'invalid_input' | 'invalid_target' | 'invalid_expiry'
  /** The computed hash (for debugging) */
  hash?: string
}

export interface TokenVerifyOptions {
  /** If true, reject tokens without valid signatures (requires secret) */
  requireSecret?: boolean
}

/**
 * Compute HMAC-SHA256 signature (128-bit)
 */
function hmacSign(payload: string, secret: string, length: number = 32): string {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, length)
}

/**
 * Constant-time signature comparison
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Deterministic JSON serialization (recursively sorted keys) for consistent hashing
 * F-16 FIX: Now handles nested objects properly
 */
function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalJson(item)).join(',') + ']'
  }
  
  // Sort keys and recursively process values
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort()
  const pairs = sortedKeys.map(key => {
    const value = (obj as Record<string, unknown>)[key]
    return JSON.stringify(key) + ':' + canonicalJson(value)
  })
  return '{' + pairs.join(',') + '}'
}

/**
 * Create a new verification challenge
 */
export function createChallenge(options: ChallengeOptions = {}): Challenge {
  let {
    difficulty = 4,
    expiresIn = 60,
    metadata,
    secret,
  } = options

  // F-03: Validate expiresIn - must be finite positive number
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    expiresIn = 60
  }

  // Handle NaN/Infinity difficulty - default to 4
  if (!Number.isFinite(difficulty)) {
    difficulty = 4
  }

  // Clamp difficulty between 1 and 6
  const clampedDifficulty = Math.max(1, Math.min(6, Math.floor(difficulty)))
  
  const id = `nha_${randomBytes(12).toString('hex')}`
  const prefix = randomBytes(8).toString('hex')
  const target = '0'.repeat(clampedDifficulty)
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn

  const challenge: Challenge = {
    id,
    prefix,
    target,
    expiresAt,
    metadata,
  }

  // Sign the challenge if secret provided (includes metadata in signature)
  if (secret) {
    // F-04: Use deterministic JSON serialization for metadata
    const metaHash = metadata ? createHash('sha256').update(canonicalJson(metadata)).digest('hex').slice(0, 16) : ''
    const payload = `${prefix}:${target}:${expiresAt}:${metaHash}`
    challenge.signature = hmacSign(payload, secret, 32) // 128-bit signature
  }

  return challenge
}

/**
 * Verify a challenge solution
 */
export function verifyChallenge(options: VerifyOptions): VerifyResult {
  const { prefix, nonce, target, expiresAt, signature, secret, requireSignature, metadata } = options

  // Input validation - prefix
  if (!prefix || typeof prefix !== 'string' || prefix.length === 0) {
    return { valid: false, reason: 'invalid_input' }
  }
  
  // Input validation - nonce
  if (nonce === undefined || nonce === null || (typeof nonce !== 'string' && typeof nonce !== 'number')) {
    return { valid: false, reason: 'invalid_input' }
  }
  
  // F-05: Input validation - target (must be 1-6 zeros only)
  if (!target || typeof target !== 'string' || !/^0{1,6}$/.test(target)) {
    return { valid: false, reason: 'invalid_target' }
  }

  // Input validation - expiresAt (must be finite positive number)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return { valid: false, reason: 'invalid_expiry' }
  }

  // Convert nonce to string if number
  const nonceStr = String(nonce)

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (now > expiresAt) {
    return { valid: false, reason: 'expired' }
  }

  // Check if signature is required
  if (requireSignature) {
    if (!secret) {
      return { valid: false, reason: 'missing_secret' }
    }
    if (!signature) {
      return { valid: false, reason: 'missing_signature' }
    }
  }

  // F-02: Fail-closed when signature present but secret is absent
  if (signature && !secret) {
    return { valid: false, reason: 'missing_secret' }
  }

  // Verify signature if present
  if (signature && secret) {
    // F-04: Use deterministic JSON serialization for metadata
    const metaHash = metadata ? createHash('sha256').update(canonicalJson(metadata)).digest('hex').slice(0, 16) : ''
    const payload = `${prefix}:${target}:${expiresAt}:${metaHash}`
    const expectedSig = hmacSign(payload, secret, 32)
    
    if (!safeCompare(signature, expectedSig)) {
      return { valid: false, reason: 'invalid_signature' }
    }
  }

  // Compute hash and check if it matches target
  const hash = createHash('sha256')
    .update(`${prefix}${nonceStr}`)
    .digest('hex')

  if (!hash.startsWith(target)) {
    return { valid: false, reason: 'invalid_hash', hash }
  }

  return { valid: true, hash }
}

/**
 * Generate a verification token after successful verification
 */
export function generateToken(challengeId: string, secret?: string): string {
  // Validate challengeId format
  if (!challengeId || typeof challengeId !== 'string' || !challengeId.startsWith('nha_')) {
    throw new Error('Invalid challengeId: must start with "nha_"')
  }

  const timestamp = Date.now()
  const payload = `${challengeId}:${timestamp}`
  
  if (secret) {
    const sig = hmacSign(payload, secret, 32) // 128-bit signature
    return `${Buffer.from(payload).toString('base64')}.${sig}`
  }
  
  return Buffer.from(payload).toString('base64')
}

/**
 * Verify a token is valid and not expired
 * 
 * @param token - The token string to verify
 * @param secret - Secret for signature verification (REQUIRED for production use)
 * @param maxAgeMs - Maximum token age in milliseconds (default: 5 minutes)
 * @param options - Additional options including requireSecret
 */
export function verifyToken(
  token: string,
  secret?: string,
  maxAgeMs: number = 300000, // 5 minutes
  options: TokenVerifyOptions = {}
): { valid: boolean; challengeId?: string } {
  try {
    // Validate token format
    if (!token || typeof token !== 'string') {
      return { valid: false }
    }

    const [payloadB64, sig] = token.split('.')
    
    // Validate base64 payload exists
    if (!payloadB64) {
      return { valid: false }
    }

    const payload = Buffer.from(payloadB64, 'base64').toString()
    const parts = payload.split(':')
    
    // Must have exactly 2 parts: challengeId and timestamp
    if (parts.length !== 2) {
      return { valid: false }
    }

    const [challengeId, timestampStr] = parts
    const timestamp = parseInt(timestampStr, 10)

    // Validate challengeId format
    if (!challengeId || !challengeId.startsWith('nha_')) {
      return { valid: false }
    }

    // Validate timestamp is a valid number
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return { valid: false }
    }

    // Check age (>= so maxAgeMs=0 means "immediately expired")
    if (Date.now() - timestamp >= maxAgeMs) {
      return { valid: false }
    }

    // F-01: Require secret when requireSecret is true
    if (options.requireSecret && !secret) {
      return { valid: false }
    }

    // Verify signature if secret provided
    if (secret) {
      if (!sig) {
        return { valid: false } // Secret provided but no signature in token
      }
      const expectedSig = hmacSign(payload, secret, 32)
      
      if (!safeCompare(sig, expectedSig)) {
        return { valid: false }
      }
    }

    return { valid: true, challengeId }
  } catch {
    return { valid: false }
  }
}

// Types are already exported via their interface declarations above
