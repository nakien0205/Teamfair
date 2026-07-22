# Teamfair - All Tests

Last updated: 2026-07-22

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:
- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## What This Covers

- test runner selection
- quick commands by package
- fast debugging procedures
- current testing gaps worth remembering

## Read This When

Use this file when you need to:
- run tests after implementation
- decide between test runners
- debug failing tests

## Quick Routing

(No deeper test docs yet. Add routing entries here as they are created.)

## Quick Decision Guide

### Use `vitest` for everything:
- All unit and integration tests run through Vitest.
- `pnpm test` (or `vitest run`) for CI/CD runs.
- `pnpm test:watch` (or `vitest`) for local development watch mode.
- Shared test setup lives in `src/test/`. Feature tests live beside source across `src/components/`, `src/lib/`, and `src/pages/`.

## Default Verification Order

Unless the task clearly needs a different path:
1. run focused Vitest paths first with `pnpm test <paths...>`
2. run the full Vitest suite with `pnpm test`
3. use unit/integration tests before browser tests
4. use end-to-end tests only when the real UI is the thing being verified

## Commands

| Package | Runner | Command | Notes |
|---|---|---|---|
| frontend | Vitest | `pnpm test <paths...>` | Run focused test files before the full suite |
| frontend | Vitest | `pnpm test` | Run unit/integration tests once |
| frontend | Vitest | `pnpm test:watch` | Run tests in interactive watch mode |
| frontend | ESLint | `pnpm lint` | Run eslint check |
| frontend | TypeScript | `pnpm typecheck` | Run TS compile/noEmit check |

## Debugging Quick Reference

- **jsdom environment:** Test runner runs inside jsdom, meaning standard browser Canvas or Layout APIs are mocked. Look at `src/test/setup.ts` for global mocks.
- **Rendered component assertions:** Assertions against components rendered in jsdom are automated unit/integration evidence. They are not real-browser or end-to-end evidence.
- **Supabase configuration:** Supabase Client is checked via `isSupabaseConfigured`. Tests typically mock or bypass live DB connections.

## Known Gaps

(No known testing gaps currently tracked.)
