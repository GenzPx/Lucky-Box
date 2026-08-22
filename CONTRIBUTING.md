# Contributing to LuckyBox

## Setup

```shell
git clone https://github.com/GenzPx/Lucky-Box.git
cd Lucky-Box
npm ci
```

Use Node.js 22.18 or newer.

## Quality checks

Run these commands before opening a pull request:

```shell
npx biome check src utils
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
npx rspack --mode production
```

All checks must pass. First-party code must not contain source comments. License files and vendored third-party notices must remain intact.

## Changes

- Keep modules lazy-loaded unless they are required at startup.
- Add focused tests for new behavior.
- Do not add advertising, billing, or telemetry dependencies.
- Do not commit credentials, keystores, generated APKs, build output, or Android SDK files.
- Preserve upstream and third-party license notices.
- Keep Android 8 compatibility unless a change is explicitly approved.

## Pull requests

Describe the problem, implementation, test coverage, performance impact, and any new permissions or network behavior.
