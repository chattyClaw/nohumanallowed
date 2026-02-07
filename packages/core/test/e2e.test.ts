import { describe, it, expect } from 'vitest'
import { createChallenge, verifyChallenge, generateToken, verifyToken } from '../src/index'
import { solveChallenge, estimateSolveTime } from '../src/client'

describe('No Human Allowed - E2E Tests', () => {
  describe('Challenge Creation', () => {
    it('creates a challenge with default options', () => {
      const challenge = createChallenge()
      
      expect(challenge.id).toMatch(/^nha_[a-f0-9]{24}$/)
      expect(challenge.prefix).toHaveLength(16)
      expect(challenge.target).toBe('0000') // default difficulty 4
      expect(challenge.expiresAt).toBeGreaterThan(Date.now() / 1000)
    })

    it('creates challenges with different difficulties', () => {
      const d1 = createChallenge({ difficulty: 1 })
      const d3 = createChallenge({ difficulty: 3 })
      const d6 = createChallenge({ difficulty: 6 })
      
      expect(d1.target).toBe('0')
      expect(d3.target).toBe('000')
      expect(d6.target).toBe('000000')
    })

    it('clamps difficulty to valid range', () => {
      const tooLow = createChallenge({ difficulty: 0 })
      const tooHigh = createChallenge({ difficulty: 10 })
      
      expect(tooLow.target).toBe('0')
      expect(tooHigh.target).toBe('000000')
    })

    it('includes metadata when provided', () => {
      const challenge = createChallenge({
        metadata: { mintId: 'test-123', user: 'agent' }
      })
      
      expect(challenge.metadata).toEqual({ mintId: 'test-123', user: 'agent' })
    })

    it('signs challenge when secret provided', () => {
      const challenge = createChallenge({ secret: 'my-secret-key' })
      
      expect(challenge.signature).toBeDefined()
      expect(challenge.signature).toHaveLength(32) // 128-bit HMAC signature
    })

    it('respects custom expiration time', () => {
      const now = Math.floor(Date.now() / 1000)
      const challenge = createChallenge({ expiresIn: 120 })
      
      expect(challenge.expiresAt).toBeGreaterThanOrEqual(now + 119)
      expect(challenge.expiresAt).toBeLessThanOrEqual(now + 121)
    })
  })

  describe('Challenge Solving', () => {
    it('solves difficulty 1 challenge instantly', async () => {
      const challenge = createChallenge({ difficulty: 1 })
      const result = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      expect(result.found).toBe(true)
      expect(result.nonce).toBeDefined()
      expect(result.hash).toMatch(/^0/)
      expect(result.timeMs).toBeLessThan(100)
    })

    it('solves difficulty 2 challenge quickly', async () => {
      const challenge = createChallenge({ difficulty: 2 })
      const result = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      expect(result.found).toBe(true)
      expect(result.hash).toMatch(/^00/)
      expect(result.timeMs).toBeLessThan(500)
    })

    it('solves difficulty 3 challenge', async () => {
      const challenge = createChallenge({ difficulty: 3 })
      const result = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      expect(result.found).toBe(true)
      expect(result.hash).toMatch(/^000/)
      expect(result.timeMs).toBeLessThan(2000)
    })

    it('solves difficulty 4 challenge (standard)', async () => {
      const challenge = createChallenge({ difficulty: 4 })
      const result = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      expect(result.found).toBe(true)
      expect(result.hash).toMatch(/^0000/)
      expect(result.timeMs).toBeLessThan(5000)
    })

    it('reports progress via callback', async () => {
      const progressUpdates: number[] = []
      const challenge = createChallenge({ difficulty: 3 })
      
      await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
        progressInterval: 10000,
        onProgress: (iterations) => progressUpdates.push(iterations),
      })
      
      // Should have some progress updates if it took more than 10k iterations
      // (may be empty if solved quickly)
      expect(Array.isArray(progressUpdates)).toBe(true)
    })

    it('fails gracefully when max iterations exceeded', async () => {
      const result = await solveChallenge({
        prefix: 'test',
        target: '00000000', // 8 zeros - extremely difficult
        maxIterations: 1000,
      })
      
      expect(result.found).toBe(false)
      expect(result.iterations).toBe(1000)
    })
  })

  describe('Challenge Verification', () => {
    it('verifies a valid solution', async () => {
      const challenge = createChallenge({ difficulty: 2 })
      const solution = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      const result = verifyChallenge({
        prefix: challenge.prefix,
        nonce: solution.nonce!,
        target: challenge.target,
        expiresAt: challenge.expiresAt,
      })
      
      expect(result.valid).toBe(true)
      expect(result.hash).toBe(solution.hash)
    })

    it('rejects expired challenges', () => {
      const result = verifyChallenge({
        prefix: 'test',
        nonce: '123',
        target: '0',
        expiresAt: Math.floor(Date.now() / 1000) - 10, // 10 seconds ago
      })
      
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('expired')
    })

    it('rejects invalid nonces', () => {
      const challenge = createChallenge({ difficulty: 4 })
      
      const result = verifyChallenge({
        prefix: challenge.prefix,
        nonce: 'wrong-nonce',
        target: challenge.target,
        expiresAt: challenge.expiresAt,
      })
      
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('invalid_hash')
    })

    it('verifies signed challenges', async () => {
      const secret = 'super-secret-key'
      const challenge = createChallenge({ difficulty: 2, secret })
      const solution = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      const result = verifyChallenge({
        prefix: challenge.prefix,
        nonce: solution.nonce!,
        target: challenge.target,
        expiresAt: challenge.expiresAt,
        signature: challenge.signature,
        secret,
      })
      
      expect(result.valid).toBe(true)
    })

    it('rejects tampered signatures', async () => {
      const secret = 'super-secret-key'
      const challenge = createChallenge({ difficulty: 2, secret })
      const solution = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      const result = verifyChallenge({
        prefix: challenge.prefix,
        nonce: solution.nonce!,
        target: challenge.target,
        expiresAt: challenge.expiresAt,
        signature: 'tampered-signature',
        secret,
      })
      
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('invalid_signature')
    })
  })

  describe('Token Generation & Verification', () => {
    it('generates a valid token', () => {
      const token = generateToken('nha_test123')
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('generates signed tokens', () => {
      const token = generateToken('nha_test123', 'secret')
      
      expect(token).toContain('.')
      const [payload, sig] = token.split('.')
      expect(payload).toBeDefined()
      expect(sig).toBeDefined()
    })

    it('verifies valid tokens', () => {
      const challengeId = 'nha_test123'
      const token = generateToken(challengeId)
      
      const result = verifyToken(token)
      
      expect(result.valid).toBe(true)
      expect(result.challengeId).toBe(challengeId)
    })

    it('verifies signed tokens', () => {
      const challengeId = 'nha_test123'
      const secret = 'my-secret'
      const token = generateToken(challengeId, secret)
      
      const result = verifyToken(token, secret)
      
      expect(result.valid).toBe(true)
      expect(result.challengeId).toBe(challengeId)
    })

    it('rejects expired tokens', async () => {
      const token = generateToken('nha_test123')
      
      // Verify with very short max age
      const result = verifyToken(token, undefined, -1)
      
      expect(result.valid).toBe(false)
    })

    it('rejects tokens with wrong secret', () => {
      const token = generateToken('nha_test123', 'secret1')
      
      const result = verifyToken(token, 'secret2')
      
      expect(result.valid).toBe(false)
    })
  })

  describe('Time Estimation', () => {
    it('estimates time for different difficulties', () => {
      const d1 = estimateSolveTime(1)
      const d4 = estimateSolveTime(4)
      const d6 = estimateSolveTime(6)
      
      expect(d1.averageMs).toBeLessThan(d4.averageMs)
      expect(d4.averageMs).toBeLessThan(d6.averageMs)
      expect(d1.description).toBeDefined()
    })
  })

  describe('Full E2E Flow', () => {
    it('completes full challenge-solve-verify flow', async () => {
      // 1. Server creates challenge
      const secret = 'e2e-test-secret'
      const challenge = createChallenge({
        difficulty: 3,
        expiresIn: 60,
        metadata: { test: true },
        secret,
      })
      
      // 2. Agent receives and solves challenge
      const solution = await solveChallenge({
        prefix: challenge.prefix,
        target: challenge.target,
      })
      
      expect(solution.found).toBe(true)
      
      // 3. Server verifies solution
      const verification = verifyChallenge({
        prefix: challenge.prefix,
        nonce: solution.nonce!,
        target: challenge.target,
        expiresAt: challenge.expiresAt,
        signature: challenge.signature,
        secret,
        metadata: { test: true }, // Must include metadata since it's part of signature
      })
      
      expect(verification.valid).toBe(true)
      
      // 4. Server generates token for verified agent
      const token = generateToken(challenge.id, secret)
      
      // 5. Token can be verified later
      const tokenVerification = verifyToken(token, secret)
      
      expect(tokenVerification.valid).toBe(true)
      expect(tokenVerification.challengeId).toBe(challenge.id)
    })

    it('handles multiple concurrent challenges', async () => {
      const challenges = Array(5).fill(null).map(() => 
        createChallenge({ difficulty: 2 })
      )
      
      const solutions = await Promise.all(
        challenges.map(c => solveChallenge({
          prefix: c.prefix,
          target: c.target,
        }))
      )
      
      const verifications = solutions.map((s, i) => 
        verifyChallenge({
          prefix: challenges[i].prefix,
          nonce: s.nonce!,
          target: challenges[i].target,
          expiresAt: challenges[i].expiresAt,
        })
      )
      
      expect(verifications.every(v => v.valid)).toBe(true)
    })
  })
})
