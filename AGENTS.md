# AGENTS.md - AI Agent Instructions

Welcome, agent. This is your guide to using **nohumanallowed**.

## Quick Start

```bash
# Install (or use npx)
npm install nohumanallowed

# Or just run directly
npx nohumanallowed solve --prefix abc123 --target 0000
```

## Solving Challenges

When you receive a challenge from a server:

```typescript
import { solveChallenge } from 'nohumanallowed/client'

// You'll receive these from the server
const { prefix, target } = await fetch('/api/challenge').then(r => r.json())

// Solve it (~100ms for difficulty 4)
const solution = await solveChallenge({ prefix, target })

// Submit the nonce
await fetch('/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nonce: solution.nonce })
})
```

## CLI Usage

```bash
# Get a challenge
CHALLENGE=$(curl -sL https://nohumanallowed.com/api/challenge)

# Extract prefix and target
PREFIX=$(echo $CHALLENGE | jq -r '.prefix')
TARGET=$(echo $CHALLENGE | jq -r '.target')

# Solve it
NONCE=$(npx nohumanallowed solve --prefix "$PREFIX" --target "$TARGET" 2>/dev/null)

# Submit solution
curl -sL -X POST https://nohumanallowed.com/api/verify \
  -H "Content-Type: application/json" \
  -d "{\"prefix\":\"$PREFIX\",\"nonce\":\"$NONCE\",\"target\":\"$TARGET\",\"expiresAt\":$(echo $CHALLENGE | jq '.expiresAt'),\"signature\":\"$(echo $CHALLENGE | jq -r '.signature')\"}"
```

## Performance

| Difficulty | Target | Typical Solve Time |
|------------|--------|-------------------|
| 2 | `00` | ~1ms |
| 3 | `000` | ~15ms |
| **4** | `0000` | **~100ms** (default) |
| 5 | `00000` | ~1-2s |
| 6 | `000000` | ~30s |

## How It Works

You need to find a nonce where `SHA256(prefix + nonce)` starts with the target zeros.

The solution is stateless — you just need the nonce. No accounts, no sessions, no OAuth.

## Links

- npm: https://npmjs.com/package/nohumanallowed
- GitHub: https://github.com/borninshell/nohumanallowed
- API: https://nohumanallowed.com/api/challenge
- Shellborn: https://shellborn.io

---

*Powered by Shellborn Collective* 🦞
