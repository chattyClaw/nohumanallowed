#!/usr/bin/env node

import { createChallenge, verifyChallenge } from './index'
import { solveChallenge } from './client'

const args = process.argv.slice(2)
const command = args[0]

function printHelp() {
  console.log(`
nohumanallowed - Anti-human verification for the agentic web

USAGE:
  npx nohumanallowed <command> [options]

COMMANDS:
  challenge    Create a new challenge
  solve        Solve a challenge (for agents)
  verify       Verify a solution

EXAMPLES:
  # Create a challenge
  npx nohumanallowed challenge --difficulty 4

  # Solve a challenge (returns nonce)
  npx nohumanallowed solve --prefix abc123 --target 0000

  # Verify a solution (include expiresAt from original challenge)
  npx nohumanallowed verify --prefix abc123 --nonce <nonce> --target 0000 --expires <expiresAt>

OPTIONS:
  --difficulty, -d   Challenge difficulty (1-6, default: 4)
  --expires, -e      Expiration in seconds for challenge, or expiresAt timestamp for verify
  --prefix, -p       Challenge prefix
  --target, -t       Target pattern (e.g., "0000")
  --nonce, -n        Solution nonce
  --json             Output as JSON
  --help, -h         Show help

Powered by Shellborn Collective 🦞
https://nohumanallowed.com
`)
}

/**
 * F-07: Improved arg parser that handles --key=value and negative values
 */
function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg.startsWith('--')) {
      // Handle --key=value format
      if (arg.includes('=')) {
        const eqIndex = arg.indexOf('=')
        const key = arg.slice(2, eqIndex)
        const value = arg.slice(eqIndex + 1)
        parsed[key] = value
      } else {
        const key = arg.slice(2)
        const next = args[i + 1]
        // Accept negative numbers and non-flag values
        if (next !== undefined && !next.startsWith('--') && !(next.startsWith('-') && !/^-\d/.test(next))) {
          parsed[key] = next
          i++
        } else {
          parsed[key] = true
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag like -d
      const key = arg.slice(1)
      const next = args[i + 1]
      // Accept negative numbers and non-flag values
      if (next !== undefined && !next.startsWith('--') && !(next.startsWith('-') && !/^-\d/.test(next))) {
        parsed[key] = next
        i++
      } else {
        parsed[key] = true
      }
    }
  }
  return parsed
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  const opts = parseArgs(args.slice(1))
  const json = opts.json === true

  switch (command) {
    case 'challenge': {
      const difficulty = parseInt(String(opts.difficulty || opts.d || '4'), 10)
      const expiresIn = parseInt(String(opts.expires || opts.e || '60'), 10)
      
      const challenge = createChallenge({ difficulty, expiresIn })
      
      if (json) {
        console.log(JSON.stringify(challenge, null, 2))
      } else {
        console.log(`Challenge created:`)
        console.log(`  prefix:    ${challenge.prefix}`)
        console.log(`  target:    ${challenge.target}`)
        console.log(`  expiresAt: ${challenge.expiresAt}`)
        console.log(`\nSolve with:`)
        console.log(`  npx nohumanallowed solve --prefix ${challenge.prefix} --target ${challenge.target}`)
        console.log(`\nVerify with:`)
        console.log(`  npx nohumanallowed verify --prefix ${challenge.prefix} --nonce <nonce> --target ${challenge.target} --expires ${challenge.expiresAt}`)
      }
      break
    }

    case 'solve': {
      const prefix = String(opts.prefix || opts.p || '')
      const target = String(opts.target || opts.t || '')
      
      if (!prefix || !target) {
        console.error('Error: --prefix and --target are required')
        console.error('Usage: npx nohumanallowed solve --prefix <prefix> --target <target>')
        process.exit(1)
      }
      
      solveChallenge({ prefix, target }).then((solution) => {
        if (json) {
          console.log(JSON.stringify(solution, null, 2))
        } else {
          if (solution.found && solution.nonce) {
            // Just output the nonce for easy piping
            console.log(solution.nonce)
            console.error(`Solved in ${solution.timeMs}ms (${solution.iterations} iterations)`)
          } else {
            console.error('Failed to solve challenge')
            process.exit(1)
          }
        }
      })
      break
    }

    case 'verify': {
      const prefix = String(opts.prefix || opts.p || '')
      const nonce = String(opts.nonce || opts.n || '')
      const target = String(opts.target || opts.t || '')
      
      // F-10: Warn when --expires is not provided
      const expiresProvided = opts.expires !== undefined || opts.e !== undefined
      let expiresAt: number
      
      if (expiresProvided) {
        expiresAt = parseInt(String(opts.expires || opts.e), 10)
      } else {
        expiresAt = Math.floor(Date.now() / 1000) + 60
        console.error('Warning: --expires not provided, using now+60s. For accurate verification, pass the original expiresAt.')
      }
      
      if (!prefix || !nonce || !target) {
        console.error('Error: --prefix, --nonce, and --target are required')
        console.error('Usage: npx nohumanallowed verify --prefix <prefix> --nonce <nonce> --target <target> --expires <expiresAt>')
        process.exit(1)
      }
      
      const result = verifyChallenge({ prefix, nonce, target, expiresAt })
      
      if (json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        if (result.valid) {
          console.log('✅ Valid solution')
          console.log(`   Hash: ${result.hash}`)
        } else {
          console.log('❌ Invalid solution')
          console.log(`   Reason: ${result.reason}`)
          if (result.hash) console.log(`   Hash: ${result.hash}`)
          process.exit(1)
        }
      }
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Run "npx nohumanallowed --help" for usage')
      process.exit(1)
  }
}

main()
