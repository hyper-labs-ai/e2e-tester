#!/usr/bin/env npx tsx
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptDir = path.resolve(__dirname, "..", "scripts");
const planManager = path.join(scriptDir, "e2e-plan-manager.ts");

async function loadFunctions(): Promise<{
  parsePlanMeta: (fp: string) => {
    name: string;
    file: string;
    version: string;
    workflows: number;
    hasHappyPath: boolean;
    lines: number;
  };
  parseWorkflows: (fp: string) => Array<{
    name: string;
    steps: number;
    edgeCases: number;
    hasCleanup: boolean;
  }>;
  analyzeRouting: (content: string) => { tier: string; reason: string };
  padRight: (s: string, n: number) => string;
}> {
  const mod = await import(planManager);
  return {
    parsePlanMeta: mod.parsePlanMeta,
    parseWorkflows: mod.parseWorkflows,
    analyzeRouting: mod.analyzeRouting,
    padRight: mod.padRight,
  };
}

function writeTempPlan(dir: string, name: string, content: string): string {
  const fp = path.join(dir, `${name}.md`);
  fs.writeFileSync(fp, content, "utf-8");
  return fp;
}

// ── Test helpers ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(label: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${label}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${RED}✗${RESET} ${label}: ${msg}`);
  }
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// ── Fixtures ──────────────────────────────────────────────────────────────

const VALID_PLAN = `# E2E Test Plan: Login Flow

## 1. Metadata
**Version**: 1.2.0

## 2. Project Overview
A simple web app.

## 3. Testing Configuration

## 4. Workflows

### Workflow 1: User Login

#### Happy Path

**Step 1:** Navigate to login page
**Step 2:** Enter email
**Step 3:** Enter password
**Step 4:** Click submit
**Step 5:** Verify dashboard loads

**Edge Case 1:** Invalid email shows error
**Edge Case 2:** Empty password shows validation

#### Cleanup
Log out.

## 5. Issue Reporting
Report issues as GitHub issues.`;

const MINIMAL_PLAN = `# Minimal Plan

## 1. Metadata
**Version**: 0.1.0

## 2. Project Overview

## 3. Testing Configuration

## 4. Workflows

### Workflow 1: Do Something

#### Detailed Steps

1. Do step one
2. Do step two

## 5. Issue Reporting
None.`;

const INCOMPLETE_PLAN = `# Incomplete Plan

Some random text without proper sections.`;

// ── Tests ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}${CYAN}E2E Plan Manager Tests${RESET}\n`);

  const fns = await loadFunctions();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-test-"));

  try {
    // ── padRight ───────────────────────────────────────────────────────
    await test("padRight pads shorter strings", () => {
      assert.equal(fns.padRight("abc", 5), "abc  ");
    });

    await test("padRight truncates longer strings", () => {
      assert.equal(fns.padRight("abcdef", 3), "abc");
    });

    await test("padRight returns exact length strings unchanged", () => {
      assert.equal(fns.padRight("abc", 3), "abc");
    });

    // ── parsePlanMeta ──────────────────────────────────────────────────
    await test("parsePlanMeta extracts metadata from valid plan", () => {
      const fp = writeTempPlan(tmpDir, "login", VALID_PLAN);
      const meta = fns.parsePlanMeta(fp);
      assert.equal(meta.name, "login");
      assert.equal(meta.version, "1.2.0");
      assert.equal(meta.workflows, 1);
      assert.equal(meta.hasHappyPath, true);
      assert.ok(meta.lines > 0);
    });

    await test("parsePlanMeta detects missing version", () => {
      const fp = writeTempPlan(tmpDir, "noversion", "# No version info");
      const meta = fns.parsePlanMeta(fp);
      assert.equal(meta.version, "unknown");
    });

    await test("parsePlanMeta detects happy path via Detailed Steps", () => {
      const fp = writeTempPlan(tmpDir, "detailed", MINIMAL_PLAN);
      const meta = fns.parsePlanMeta(fp);
      assert.equal(meta.hasHappyPath, true);
      assert.equal(meta.workflows, 1);
    });

    await test("parsePlanMeta counts multiple workflows", () => {
      const multiWf = VALID_PLAN.replace(
        "### Workflow 1: User Login",
        "### Workflow 1: Login\n\n### Workflow 2: Logout",
      );
      const fp = writeTempPlan(tmpDir, "multi", multiWf);
      const meta = fns.parsePlanMeta(fp);
      assert.equal(meta.workflows, 2);
    });

    // ── parseWorkflows ─────────────────────────────────────────────────
    await test("parseWorkflows parses workflow steps and edge cases", () => {
      const fp = writeTempPlan(tmpDir, "wf-login", VALID_PLAN);
      const wfs = fns.parseWorkflows(fp);
      assert.equal(wfs.length, 1);
      assert.equal(wfs?.[0]?.name, "User Login");
      assert.equal(wfs?.[0]?.steps, 5);
      assert.equal(wfs?.[0]?.edgeCases, 2);
      assert.equal(wfs?.[0]?.hasCleanup, true);
    });

    await test("parseWorkflows returns empty for no workflows", () => {
      const fp = writeTempPlan(tmpDir, "empty-wf", "# No workflows here");
      const wfs = fns.parseWorkflows(fp);
      assert.equal(wfs.length, 0);
    });

    // ── analyzeRouting ──────────────────────────────────────────────────
    await test("analyzeRouting detects specific selectors → Tier A", () => {
      const result = fns.analyzeRouting(
        '[data-testid="login"] button:has-text("Submit") #main-form .btn-primary getByRole getByTestId',
      );
      assert.equal(result.tier, "A");
    });

    await test("analyzeRouting detects mixed patterns → Tier B", () => {
      const result = fns.analyzeRouting(
        "Click the submit button. getByTestId('login-form') #email-input waitForSelector('[data-ready=true]') and verify the dashboard looks correct",
      );
      assert.equal(result.tier, "B");
    });

    await test("analyzeRouting detects vague patterns → Tier C", () => {
      const result = fns.analyzeRouting(
        "Click the submit button. Verify the layout looks correct. Use manual judgment to check appearance.",
      );
      assert.equal(result.tier, "C");
    });

    await test("analyzeRouting detects CAPTCHA → Tier C", () => {
      const result = fns.analyzeRouting(
        "Complete the reCAPTCHA challenge before proceeding",
      );
      assert.equal(result.tier, "C");
    });

    await test("analyzeRouting detects MFA/2FA → Tier C", () => {
      const result = fns.analyzeRouting(
        "Enter the MFA code from authenticator app",
      );
      assert.equal(result.tier, "C");
    });

    await test("analyzeRouting no patterns → Tier B (fallback)", () => {
      const result = fns.analyzeRouting(
        "This workflow has no clear selectors or patterns at all",
      );
      assert.equal(result.tier, "B");
    });

    await test("analyzeRouting very specific with strong ratio → Tier A", () => {
      const result = fns.analyzeRouting(`
        getByRole('button', { name: 'Submit' })
        getByTestId('user-profile')
        #main-header .nav-item
        waitForSelector('[data-loading="false"]')
        locator('[data-testid="list"]').first()
      `);
      assert.equal(result.tier, "A");
    });

    // ── CLI commands (smoke tests) ─────────────────────────────────────
    await test("check command returns 'absent' when no .e2e-plans/", async () => {
      const result = await runCli("check");
      assert.equal(result.trim(), "absent");
    });

    await test("list command handles missing directory gracefully", async () => {
      const result = await runCli("list");
      assert.ok(result.includes("No .e2e-plans"));
    });

    await test("validate on missing directory fails gracefully", async () => {
      const result = await runCli("validate");
      assert.ok(result.includes("No .e2e-plans"));
    });

    await test("route on missing directory fails gracefully", async () => {
      const result = await runCli("route");
      assert.ok(result.includes("No .e2e-plans"));
    });

    // ── scaffold CLI test ──────────────────────────────────────────────
    await test("scaffold creates .e2e-plans/ directory", async () => {
      const scaffoldDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "e2e-scaffold-"),
      );
      try {
        const { execSync } = await import("node:child_process");
        execSync(`npx tsx ${planManager} scaffold`, {
          encoding: "utf-8",
          cwd: scaffoldDir,
        });
        assert.ok(fs.existsSync(path.join(scaffoldDir, ".e2e-plans")));
        assert.ok(fs.existsSync(path.join(scaffoldDir, ".e2e-plans/results")));
        assert.ok(fs.existsSync(path.join(scaffoldDir, ".e2e-plans/scripts")));
        assert.ok(
          fs.existsSync(path.join(scaffoldDir, ".e2e-plans/screenshots")),
        );
        assert.ok(fs.existsSync(path.join(scaffoldDir, ".e2e-plans/issues")));
        assert.ok(
          fs.existsSync(path.join(scaffoldDir, ".e2e-plans/README.md")),
        );
      } finally {
        fs.rmSync(scaffoldDir, { recursive: true, force: true });
      }
    });

    await test("scaffold is idempotent (no error on re-run)", async () => {
      const scaffoldDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-idem-"));
      try {
        const { execSync } = await import("node:child_process");
        execSync(`npx tsx ${planManager} scaffold`, {
          encoding: "utf-8",
          cwd: scaffoldDir,
        });
        execSync(`npx tsx ${planManager} scaffold`, {
          encoding: "utf-8",
          cwd: scaffoldDir,
        });
        assert.ok(fs.existsSync(path.join(scaffoldDir, ".e2e-plans")));
      } finally {
        fs.rmSync(scaffoldDir, { recursive: true, force: true });
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (_cliTmpDir) {
      fs.rmSync(_cliTmpDir, { recursive: true, force: true });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(
    `\n${BOLD}${total} test(s): ${GREEN}${passed} passed${RESET}${failed > 0 ? `, ${RED}${failed} failed${RESET}` : ""}${RESET}\n`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

async function runCli(command: string, arg?: string): Promise<string> {
  const { execSync } = await import("node:child_process");
  const args = [planManager, command];
  if (arg) args.push(arg);
  try {
    return execSync(`npx tsx ${args.join(" ")}`, {
      encoding: "utf-8",
      cwd: tmpDirForCli(),
    });
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return err.stderr || err.stdout || err.message || String(e);
  }
}

let _cliTmpDir: string | null = null;
function tmpDirForCli(): string {
  if (!_cliTmpDir) {
    _cliTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-cli-"));
  }
  return _cliTmpDir;
}

main().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
