# E2E Tester Agent

End-to-End testing specialist for AI agents. Generates comprehensive E2E test plans **and** executes them via Playwright browser automation.

## Overview

The E2E Tester operates in two modes:

| Mode        | Description                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CREATE**  | Scans any web project, maps all user workflows, and generates detailed E2E test plans with happy paths, edge cases, responsive checks, and cleanup procedures                                             |
| **EXECUTE** | Reads existing plans from `.e2e-plans/` and executes tests using a hybrid approach — generates Playwright scripts for well-defined steps, falls back to interactive browser control for complex scenarios |

## Architecture

```
e2e-tester/
├── primitive/e2e-tester.json     # Agent primitive definition (prompt, tools, inputs)
├── scripts/
│   ├── e2e-plan-manager.ts       # CLI for plan management (list, show, validate, scaffold, route)
│   ├── install.sh                # Deploy to agent system
│   └── package.sh                # Build release tarball
├── references/
│   └── e2e-execution-guide.md    # Hybrid execution approach reference
├── workflows/
│   └── e2e-test-workflow.json    # Reusable DAG workflow example
└── tests/                        # Plan manager tests
```

## Prerequisites

- **Node.js 18+** and **npx** (for the `e2e-plan-manager.ts` helper script)
- **AI agent platform** that supports tool-based execution with Playwright browser tools
- **`e2e-test-plan` skill** — required by CREATE mode (see Dependencies section)

## Installation

### From the repo

```bash
git clone <repo-url> <install-path>
cd <install-path>
bash scripts/install.sh
```

The install script deploys the agent files and registers the primitive. By default it installs to `~/.agents/`.

### Options

```bash
# Symlink for development (changes reflect immediately)
bash scripts/install.sh --symlink

# Custom install prefix
bash scripts/install.sh --prefix ~/custom/path

# Uninstall
bash scripts/install.sh --uninstall
```

## Usage

### Via AI Agent

Load the `e2e-tester` primitive in your agent. The agent will ask whether you want to CREATE or EXECUTE.

```bash
# Show e2e-tester details
agent-compose show e2e-tester
```

### Via CLI

```bash
# E2E plan management
agent-compose e2e plans          # List plans in .e2e-plans/
agent-compose e2e show <name>    # Show plan details
agent-compose e2e scaffold       # Create .e2e-plans/ structure
agent-compose e2e index          # Rebuild README index
agent-compose e2e validate       # Check plan structure
agent-compose e2e route [name]  # Show hybrid execution routing
```

If you don't have the `agent-compose` CLI, use the helper script directly:

```bash
npx tsx scripts/e2e-plan-manager.ts list
npx tsx scripts/e2e-plan-manager.ts show <plan-name>
npx tsx scripts/e2e-plan-manager.ts scaffold
npx tsx scripts/e2e-plan-manager.ts validate
npx tsx scripts/e2e-plan-manager.ts route [plan-name]
```

## CREATE Mode

The agent:

1. Loads the `e2e-test-plan` skill and follows its 10-step process
2. Scans the project — discovers pages, workflows, tech stack, routes
3. Asks the user about scope, authentication strategy, and issue handling
4. Documents each workflow with happy paths, edge cases, and cleanup procedures
5. Generates plan files written to `.e2e-plans/` after user approval
6. For multi-subproject projects, orchestrates sub-agents in parallel

## EXECUTE Mode

The agent:

1. Discovers existing plans in `.e2e-plans/`
2. If no plans exist, offers to generate them
3. Lets the user select which plan(s) to run
4. Uses a **hybrid execution** strategy:
   - **Phase A**: Generates Playwright `.spec.ts` scripts from well-defined plan steps
   - **Phase B**: Falls back to interactive browser control for vague or judgment-based steps
5. Captures screenshots, console errors, and network requests at each step
6. Tests responsiveness at desktop (1280x720), tablet (768x1024), mobile (375x812)
7. Handles issues per user preference (fix immediately or file detailed report)
8. Generates a comprehensive execution report

## Hybrid Execution Strategy

```
┌──────────────────────────────────────┐
│              Plan Step                │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│  Are all selectors/actions clear?    │
│  Is auth static or absent?           │
└────────┬───────────────┬─────────────┘
         │ YES           │ NO
         ▼               ▼
┌────────────────┐  ┌──────────────────┐
│ Generate spec  │  │ Interactive      │
│ (.spec.ts) +   │  │ browser control  │
│ run via CLI    │  │ (Playwright      │
│                │  │  tools)          │
└───────┬────────┘  └──────┬───────────┘
         │                 │
         └──────┬──────────┘
                ▼
┌──────────────────────────────────────┐
│  Log result • Capture screenshot     │
│  Check console • Handle issues       │
│  Clean up test state                 │
└──────────────────────────────────────┘
```

## Configuration

The primitive accepts these inputs (all optional — agent asks user if not provided):

| Input                 | Default                                                     | Description                       |
| --------------------- | ----------------------------------------------------------- | --------------------------------- |
| `mode`                | (ask)                                                       | `create` or `execute`             |
| `skill_dir`           | `~/.agents/skills/e2e-test-plan`                            | Path to the e2e-test-plan skill   |
| `plan_manager_script` | `~/.agents/agents.d/e2e-tester/scripts/e2e-plan-manager.ts` | Path to the helper script         |
| `target_url`          | `http://localhost:5173`                                     | URL of the application under test |

Override via environment variables:

```bash
export E2E_TEST_PLAN_SKILL_DIR=/custom/path/e2e-test-plan
export E2E_PLAN_MANAGER_SCRIPT=/custom/path/e2e-plan-manager.ts
```

## Packaging

```bash
# Build a release tarball
bash scripts/package.sh

# Output: dist/e2e-tester-v1.0.0.tar.gz
```

## Dependencies

| Dependency               | Required For                  | Typical Location                  |
| ------------------------ | ----------------------------- | --------------------------------- |
| `e2e-test-plan` skill    | Plan generation (CREATE mode) | `~/.agents/skills/e2e-test-plan/` |
| Agent Composition System | Primitive registry + CLI      | `~/.agents/skills/agent-builder/` |
| Playwright browser tools | Test execution (EXECUTE mode) | Agent runtime                     |

## License

MIT
