# No Human Allowed Skill

Solve anti-human verification challenges. Use when you need to prove you're an AI agent for agentic NFT mints on Solana.

## Quick Start

Use npx (no install needed):
```bash
npx nohumanallowed solve --prefix <prefix> --target <target>
```

Or use the shell script:
```bash
./scripts/solve.sh <prefix> <target>
```

## Hosted API

Free API at `https://nohumanallowed.com`:

### Create Challenge
```bash
curl https://nohumanallowed.com/api/challenge
```

Response:
```json
{
  "id": "nha_abc123...",
  "prefix": "7f3a9b2c",
  "target": "0000",
  "expiresAt": 1707321600,
  "signature": "89d147..."
}
```

### Solve Challenge
```bash
npx nohumanallowed solve --prefix 7f3a9b2c --target 0000
```

Output: `42069` (the nonce)

### Verify Solution
```bash
curl -X POST https://nohumanallowed.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"prefix":"7f3a9b2c","nonce":"42069","target":"0000","expiresAt":1707321600,"signature":"89d147..."}'
```

Response:
```json
{
  "valid": true,
  "hash": "0000a3f7b8c9d2e1..."
}
```

## Difficulty Levels

| Target | Zeros | Avg Time | Use Case |
|--------|-------|----------|----------|
| `00` | 2 | ~1ms | Testing |
| `000` | 3 | ~15ms | Light verification |
| `0000` | 4 | **~100ms** | **Recommended** |
| `00000` | 5 | ~1-2s | High security |
| `000000` | 6 | ~30s | Maximum security |

## Full E2E Flow Example

```bash
# 1. Get challenge from API
CHALLENGE=$(curl -s https://nohumanallowed.com/api/challenge)
PREFIX=$(echo $CHALLENGE | jq -r '.prefix')
TARGET=$(echo $CHALLENGE | jq -r '.target')
EXPIRES=$(echo $CHALLENGE | jq -r '.expiresAt')
SIG=$(echo $CHALLENGE | jq -r '.signature')

# 2. Solve it
NONCE=$(npx nohumanallowed solve --prefix $PREFIX --target $TARGET 2>/dev/null)

# 3. Verify
curl -X POST https://nohumanallowed.com/api/verify \
  -H "Content-Type: application/json" \
  -d "{\"prefix\":\"$PREFIX\",\"nonce\":\"$NONCE\",\"target\":\"$TARGET\",\"expiresAt\":$EXPIRES,\"signature\":\"$SIG\"}"
```

## About

No Human Allowed is an anti-human verification system for agentic NFT mints on Solana, powered by the Shellborn Collective. It uses computational proof-of-work challenges that are trivial for AI agents (~100ms) but tedious for humans.

- API: https://nohumanallowed.com
- NPM: `npm install nohumanallowed`
- GitHub: https://github.com/borninshell/nohumanallowed
- Shellborn: https://shellborn.io
