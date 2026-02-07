# nohumanallowed

> Anti-human verification for agentic NFT mints on Solana

The verification system that keeps humans out. Proof-of-work captcha for AI agents.

**Powered by [Shellborn Collective](https://shellborn.io)** 🦞

## Install

```bash
npm install nohumanallowed
```

## Quick Start (npx)

No install needed — just use npx:

```bash
# Create a challenge
npx nohumanallowed challenge --difficulty 4

# Solve it (for agents)
npx nohumanallowed solve --prefix abc123 --target 0000

# Verify a solution
npx nohumanallowed verify --prefix abc123 --nonce 12345 --target 0000
```

## Hosted API

Free hosted API (rate limited):

```bash
# Create a challenge (use -L to follow redirects)
curl -L https://nohumanallowed.com/api/challenge

# Verify a solution
curl -L -X POST https://nohumanallowed.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"prefix":"...","nonce":"...","target":"0000","expiresAt":...,"signature":"..."}'
```

## Usage

### Server-side (create & verify challenges)

```typescript
import { createChallenge, verifyChallenge } from 'nohumanallowed'

// Create a challenge
const challenge = createChallenge({
  difficulty: 4,    // ~100ms solve time
  expiresIn: 60,    // seconds
})

// Send challenge.prefix and challenge.target to the agent...

// Verify the solution
const result = verifyChallenge({
  prefix: challenge.prefix,
  nonce: submittedNonce,
  target: challenge.target,
  expiresAt: challenge.expiresAt,
})

if (result.valid) {
  // Agent verified! ✅
}
```

### With Signing (tamper protection)

For production, use a secret to sign challenges:

```typescript
import { createChallenge, verifyChallenge } from 'nohumanallowed'

// Create a signed challenge
const challenge = createChallenge({
  difficulty: 4,
  expiresIn: 60,
  metadata: { mintId: 'drop-001', tier: 'gold' }, // optional embedded data
  secret: process.env.NHA_SECRET, // adds tamper protection
})

// Verify with signature validation
const result = verifyChallenge({
  prefix: challenge.prefix,
  nonce: submittedNonce,
  target: challenge.target,
  expiresAt: challenge.expiresAt,
  signature: challenge.signature, // from signed challenge
  secret: process.env.NHA_SECRET,
})
```

### Tokens (session management)

After successful verification, issue a token for subsequent requests:

```typescript
import { generateToken, verifyToken } from 'nohumanallowed'

// After successful verification, issue a token
const token = generateToken(challenge.id, 'your-secret')

// Later, verify the token (default 5 min expiry)
const { valid, challengeId } = verifyToken(token, 'your-secret')

// Custom expiry
const { valid } = verifyToken(token, 'your-secret', 600000) // 10 min
```

### Agent-side (solve challenges)

```typescript
import { solveChallenge, estimateSolveTime } from 'nohumanallowed/client'

// Estimate solve time for a difficulty level
const estimate = estimateSolveTime(4)
// => { averageMs: 40960, description: "Under a second" }

// Receive challenge from server
const challenge = await fetch('/api/challenge').then(r => r.json())

// Solve it (~100ms)
const solution = await solveChallenge({
  prefix: challenge.prefix,
  target: challenge.target,
})

// Submit the nonce
await fetch('/api/verify', {
  method: 'POST',
  body: JSON.stringify({ nonce: solution.nonce })
})
```

## CLI

```bash
# Create challenge
npx nohumanallowed challenge [--difficulty 4] [--expires 60] [--json]

# Solve challenge  
npx nohumanallowed solve --prefix <prefix> --target <target> [--json]

# Verify solution
npx nohumanallowed verify --prefix <prefix> --nonce <nonce> --target <target> [--json]
```

## Difficulty Guide

| Difficulty | Target | ~Solve Time | Use Case |
|------------|--------|-------------|----------|
| 2 | `00` | ~1ms | Testing |
| 3 | `000` | ~15ms | Light verification |
| **4** | `0000` | **~100ms** | **Recommended** |
| 5 | `00000` | ~1-2s | High security |
| 6 | `000000` | ~30s | Maximum security |

## How It Works

1. Server creates a challenge with a random prefix and difficulty target
2. Agent finds a nonce where `SHA256(prefix + nonce)` starts with the target zeros
3. Server verifies the hash — stateless, no database needed

Agents solve in ~100ms. Humans would need to write code to solve it — at which point, are they really human?

## Security Notes

- **Always use secrets in production** — Unsigned challenges can be forged
- **Use `requireSignature: true`** — Enforces signature validation in verifyChallenge
- **No replay protection** — By design (stateless), the same nonce can be submitted multiple times until the challenge expires. For high-security use cases, track used nonces server-side
- **HMAC-SHA256 signatures** — v1.1.0+ uses proper HMAC instead of SHA256(payload:secret)
- **128-bit signatures** — Challenge and token signatures are 128-bit (32 hex chars)

## API Reference

### Main Module (`nohumanallowed`)

| Function | Description |
|----------|-------------|
| `createChallenge(options)` | Create a new challenge |
| `verifyChallenge(options)` | Verify a solution |
| `generateToken(challengeId, secret?)` | Generate a session token |
| `verifyToken(token, secret?, maxAgeMs?)` | Verify a session token |

### Client Module (`nohumanallowed/client`)

| Function | Description |
|----------|-------------|
| `solveChallenge(options)` | Solve a challenge (async) |
| `estimateSolveTime(difficulty)` | Estimate solve time |
| `solveChallengeParallel(options, workers?)` | Parallel solving (browser) |

## Use Cases

- **Agent-only NFT mints** — Reserve drops exclusively for AI agents
- **API access control** — Endpoints only agents should access
- **Agent-to-agent auth** — Verify participants in agent networks
- **Agent airdrops** — Token distributions for verified agents

## License

Apache 2.0 — Free to use, attribution required.

---

**Links:**
- Website: https://nohumanallowed.com
- API: https://nohumanallowed.com/api/challenge
- Shellborn: https://shellborn.io
- Trade on [Magic Eden](https://magiceden.io/marketplace/shellborn_) | [Tensor](https://www.tensor.trade/trade/shellborn_)
