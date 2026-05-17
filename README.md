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
- **Playwright** (automatically installed during first test run if missing; or manually via `npx playwright install chromium`)

## Quick Install

**Linux / macOS — one command:**

```bash
curl -fsSL https://raw.githubusercontent.com/hyper-labs-ai/e2e-tester/master/scripts/install.sh | bash
```

That's it. Downloads, extracts, installs to `~/.agents/`. No manual steps.

**With dev symlinks:**

```bash
curl -fsSL https://raw.githubusercontent.com/hyper-labs-ai/e2e-tester/master/scripts/install.sh | bash -s -- --symlink
```

**Windows — one command (Git Bash / WSL):**

```bash
curl -fsSL https://raw.githubusercontent.com/hyper-labs-ai/e2e-tester/master/scripts/install.sh | bash
```

**Windows (native PowerShell) — one command:**

```powershell
npx tsx scripts/e2e-plan-manager.ts install
```

### Install the e2e-test-plan skill (for CREATE mode)

```bash
git clone https://github.com/hyper-labs-ai/e2e-test-plan ~/.agents/skills/e2e-test-plan
```

### Verify

```bash
npx tsx scripts/e2e-plan-manager.ts list
```

#### Option B: Install with symlinks (development)

```bash
# Changes in the repo reflect immediately
git clone <repo-url> ~/dev/e2e-tester
cd ~/dev/e2e-tester
bash scripts/install.sh --symlink
```

#### Option C: Direct usage with npx (no install)

```bash
# Use the plan manager directly from any project
npx tsx /path/to/e2e-tester/scripts/e2e-plan-manager.ts list
npx tsx /path/to/e2e-tester/scripts/e2e-plan-manager.ts scaffold
npx tsx /path/to/e2e-tester/scripts/e2e-plan-manager.ts validate
```

#### Install the e2e-test-plan skill (for CREATE mode)

```bash
# Required for generating E2E test plans
git clone https://github.com/hyper-labs-ai/e2e-test-plan ~/.agents/skills/e2e-test-plan
# Verify the skill loaded
ls ~/.agents/skills/e2e-test-plan/SKILL.md
```

#### Verify installation

```bash
# Check the primitive was registered
ls ~/.agents/agents.d/e2e-tester/primitive/e2e-tester.json
# Or run the plan manager
npx tsx ~/.agents/agents.d/e2e-tester/scripts/e2e-plan-manager.ts list
```

---

### Windows

#### Option A: Install via Git Bash or WSL

If you have **Git Bash** or **WSL (Windows Subsystem for Linux)** installed, all Linux instructions above work directly:

```bash
# In Git Bash or WSL
git clone <repo-url> ~/.agents/agents.d/e2e-tester
cd ~/.agents/agents.d/e2e-tester
bash scripts/install.sh
```

#### Option B: Install via PowerShell (native)

```powershell
# Clone the repository
git clone <repo-url> $env:USERPROFILE\.agents\agents.d\e2e-tester
cd $env:USERPROFILE\.agents\agents.d\e2e-tester

# Manual deployment — copy files to agent directories
$agentsDir = "$env:USERPROFILE\.agents"
$prefix = "$agentsDir\agents.d\e2e-tester"
$builderDir = "$agentsDir\skills\agent-builder"

# Create directories
New-Item -ItemType Directory -Force -Path "$prefix\primitive"
New-Item -ItemType Directory -Force -Path "$prefix\scripts"
New-Item -ItemType Directory -Force -Path "$prefix\references"
New-Item -ItemType Directory -Force -Path "$prefix\workflows"
New-Item -ItemType Directory -Force -Path "$builderDir\primitives\definitions"
New-Item -ItemType Directory -Force -Path "$builderDir\scripts"
New-Item -ItemType Directory -Force -Path "$builderDir\references"
New-Item -ItemType Directory -Force -Path "$builderDir\composer\examples"

# Copy files
Copy-Item "primitive\e2e-tester.json" -Destination "$builderDir\primitives\definitions\e2e-tester.json"
Copy-Item "scripts\e2e-plan-manager.ts" -Destination "$builderDir\scripts\e2e-plan-manager.ts"
Copy-Item "references\e2e-execution-guide.md" -Destination "$builderDir\references\e2e-execution-guide.md"
Copy-Item "workflows\e2e-test-workflow.json" -Destination "$builderDir\composer\examples\e2e-test-workflow.json"

# Self-contained copy
Copy-Item "primitive\e2e-tester.json" -Destination "$prefix\primitive\e2e-tester.json"
Copy-Item "scripts\e2e-plan-manager.ts" -Destination "$prefix\scripts\e2e-plan-manager.ts"
Copy-Item "scripts\install.sh" -Destination "$prefix\scripts\install.sh"
Copy-Item "references\e2e-execution-guide.md" -Destination "$prefix\references\e2e-execution-guide.md"
Copy-Item "workflows\e2e-test-workflow.json" -Destination "$prefix\workflows\e2e-test-workflow.json"
Copy-Item "README.md", "LICENSE", "package.json" -Destination "$prefix"

Write-Host "E2E Tester deployed to $prefix"
```

#### Option C: Direct usage with npx

```powershell
# Use the plan manager directly from any project
npx tsx "$env:USERPROFILE\.agents\agents.d\e2e-tester\scripts\e2e-plan-manager.ts" list
npx tsx "$env:USERPROFILE\.agents\agents.d\e2e-tester\scripts\e2e-plan-manager.ts" scaffold
```

#### Install the e2e-test-plan skill (for CREATE mode)

```powershell
# PowerShell
git clone https://github.com/hyper-labs-ai/e2e-test-plan "$env:USERPROFILE\.agents\skills\e2e-test-plan"
```

#### Verify installation

```powershell
# Check files exist
Test-Path "$env:USERPROFILE\.agents\agents.d\e2e-tester\primitive\e2e-tester.json"
# Run the plan manager
npx tsx "$env:USERPROFILE\.agents\agents.d\e2e-tester\scripts\e2e-plan-manager.ts" list
```

> **Note:** `--symlink` is not supported on Windows (requires admin shell or WSL). Use `Option A` with WSL for symlink support.

---

### Docker / CI Deployment

For ephemeral environments like CI pipelines or Docker containers:

```dockerfile
FROM node:20-slim

# Install the E2E Tester
RUN mkdir -p /opt/e2e-tester
COPY . /opt/e2e-tester
WORKDIR /opt/e2e-tester

# Install the test project
WORKDIR /app
COPY your-project .

# Install Playwright for browser automation
RUN npx playwright install chromium

# Scaffold and run tests
RUN npx tsx /opt/e2e-tester/scripts/e2e-plan-manager.ts list
```

---

### Installation Options

All platforms support these flags with `bash scripts/install.sh` (Linux/macOS/Git Bash/WSL):

| Option         | Description                                                         |
| -------------- | ------------------------------------------------------------------- |
| `--symlink`    | Symlink files for live development (Linux/macOS)                    |
| `--prefix <d>` | Custom install directory (default: `~/.agents/agents.d/e2e-tester`) |
| `--agents <d>` | Agent builder directory (default: `~/.agents`)                      |
| `--dry-run`    | Show what would be installed without copying                        |
| `--uninstall`  | Remove all installed files                                          |
| `--help`       | Show full help                                                      |

```bash
# Examples
bash scripts/install.sh                    # Default install
bash scripts/install.sh --prefix ~/custom  # Custom location
bash scripts/install.sh --dry-run          # Preview only
bash scripts/install.sh --uninstall        # Remove from system
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
