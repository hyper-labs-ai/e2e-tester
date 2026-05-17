# E2E Tester — Agent Instructions

This repo defines the **E2E Tester** agent primitive for the Agent Composition System. It is not a runnable application — it is an agent definition deployed to `~/.agents/agents.d/e2e-tester/`.

## Architecture

- `primitive/e2e-tester.json` — agent prompt, tool list, and I/O schema (the core artifact)
- `scripts/e2e-plan-manager.ts` — CLI for `.e2e-plans/` management (list, show, scaffold, index, check, validate)
- `scripts/install.sh` — deploys to `~/.agents/` (supports `--symlink` for live dev)
- `scripts/package.sh` — builds release tarball to `dist/`
- `references/e2e-execution-guide.md` — hybrid execution instructions consumed by the agent at runtime
- `workflows/e2e-test-workflow.json` — DAG workflow for the Composer system
- `tests/` — empty; no test framework is set up yet

## Developer Commands

```bash
npm run format        # npx prettier --write .
npm run package       # bash scripts/package.sh
npm run list          # npx tsx scripts/e2e-plan-manager.ts list
npm run validate      # npx tsx scripts/e2e-plan-manager.ts validate
npm run scaffold      # npx tsx scripts/e2e-plan-manager.ts scaffold
npm run route         # npx tsx scripts/e2e-plan-manager.ts route [plan-name]
npm run test          # npx tsx tests/e2e-plan-manager.test.ts
```

TypeScript is run directly via `npx tsx` (no tsconfig in the repo).

## Dev Workflow

```bash
# Live development — makes repo changes reflect immediately
bash scripts/install.sh --symlink

# Build release artifact
bash scripts/package.sh
```

## External Dependencies

- **e2e-test-plan skill** at `~/.agents/skills/e2e-test-plan/` — required by CREATE mode
- **Agent Composition System** at `~/.agents/skills/agent-builder/` — registers the primitive

## Key Constraints

- Two mutually exclusive modes: CREATE (plan generation) and EXECUTE (plan execution)
- Plans live in `.e2e-plans/` in the **target project's** working directory, not this repo
- The agent uses both Playwright script generation and interactive browser tools (hybrid strategy)
- No CI, no pre-commit hooks, no lint config beyond `prettier`
