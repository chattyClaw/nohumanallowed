#!/bin/bash
# No Human Allowed - Challenge Solver
# Usage: ./solve.sh <prefix> <target>

PREFIX="${1:?Usage: solve.sh <prefix> <target>}"
TARGET="${2:-0000}"

# Validate inputs contain only hex characters to prevent injection
if [[ ! "$PREFIX" =~ ^[a-fA-F0-9]+$ ]]; then
  echo "Error: prefix must be hexadecimal" >&2
  exit 1
fi

if [[ ! "$TARGET" =~ ^0+$ ]]; then
  echo "Error: target must be leading zeros (e.g., 0000)" >&2
  exit 1
fi

# Pass as environment variables to avoid shell interpolation in JS string
NHA_PREFIX="$PREFIX" NHA_TARGET="$TARGET" node -e '
const crypto = require("crypto");
const prefix = process.env.NHA_PREFIX;
const target = process.env.NHA_TARGET;

const start = Date.now();
let nonce = 0;

while (true) {
  const hash = crypto.createHash("sha256")
    .update(prefix + nonce)
    .digest("hex");
  
  if (hash.startsWith(target)) {
    const ms = Date.now() - start;
    console.log(JSON.stringify({
      nonce: nonce.toString(),
      hash,
      timeMs: ms,
      iterations: nonce + 1
    }));
    break;
  }
  nonce++;
  
  if (nonce > 100000000) {
    console.error("Max iterations reached");
    process.exit(1);
  }
}
'
