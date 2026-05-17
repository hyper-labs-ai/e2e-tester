# E2E Test Execution Guide

Reference document for the **E2E Tester** agent when executing tests in **EXECUTE MODE**.

## Hybrid Execution Approach

Tests are executed using a three-tier hybrid approach:

1. **Phase A: Automated Script** — Generate a self-contained Playwright `.spec.ts` file and run it
2. **Phase B: Guided Tool Execution** — Use `playwright_browser_run_code_unsafe` to run inline code in the Playwright runtime
3. **Phase C: Interactive Fallback** — Step through interactively using `playwright_browser_*` tools

### Decision Flow

```
For each workflow in the plan:

┌─ All steps have specific selectors AND
│  actions are well-defined AND
│  no auth interaction needed?
│     YES → Phase A (generate & run script)
│     NO  ─┐
│          └─ Workflow has some specific selectors AND
│             only a few vague steps?
│                YES → Phase B (guided code execution)
│                NO  ─┐
│                     └─ Phase C (interactive step-by-step)
```

### Pre-Execution Checklist

Before running any test, verify:

- [ ] App is reachable at the target URL (run `playwright_browser_navigate`)
- [ ] `.e2e-plans/results/` directory exists (run `scaffold` if not)
- [ ] `.e2e-plans/screenshots/` directory exists
- [ ] `.e2e-plans/issues/` directory exists
- [ ] Screenshot run directory created: `.e2e-plans/screenshots/<run-timestamp>/`

## Phase A: Automated Script Generation

### When to Generate Scripts

Use Phase A when ALL of these are true:

- Every step has clear selectors (data-testid, CSS, aria-label)
- Actions are well-defined (click, type, select, navigate)
- Expected outcomes are concrete (element visible, text present, URL changed)
- Authentication is static (env file) or not required

### Self-Contained Script Template

```typescript
#!/usr/bin/env npx tsx
/**
 * Auto-generated E2E test from plan.
 * Run: npx tsx .e2e-plans/scripts/<workflow>.spec.ts
 * Env: APP_URL (defaults to {{target_url}})
 */

// Auto-ensure Playwright is available
async function ensurePlaywright() {
  const { execSync } = await import("node:child_process");
  try {
    await import("playwright");
  } catch {
    console.log("Installing Playwright...");
    execSync("npm install playwright", { stdio: "pipe" });
    execSync("npx playwright install chromium", { stdio: "pipe" });
  }
}

interface StepResult {
  step: number;
  name: string;
  passed: boolean;
  error?: string;
  screenshot?: string;
}

async function run() {
  await ensurePlaywright();

  const { chromium } = await import("playwright");
  const APP_URL = process.env.APP_URL || "{{target_url}}";
  const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || ".e2e-plans/screenshots";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const results: StepResult[] = [];

  async function step(
    n: number,
    name: string,
    fn: (p: typeof page) => Promise<void>,
  ) {
    try {
      await fn(page);
      results.push({ step: n, name, passed: true });
      console.log(`  ✓ Step ${n}: ${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const screenshotPath = `${SCREENSHOT_DIR}/step-${n}-FAILED.png`;
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {}
      results.push({
        step: n,
        name,
        passed: false,
        error: msg,
        screenshot: screenshotPath,
      });
      console.error(`  ✗ Step ${n}: ${name} — ${msg}`);
    }
  }

  try {
    // ── Workflow steps ──────────────────────────────────────────────
    // Each step from the plan maps to a `step()` call:

    await step(1, "Navigate to app", async (p) => {
      await p.goto(APP_URL, { waitUntil: "networkidle" });
    });

    // Add more steps following the plan...
  } finally {
    await browser.close();
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run().catch(console.error);
```

### Running Phase A Scripts

```bash
# Set the target URL
export APP_URL=http://localhost:3000

# Run the test (auto-installs Playwright if needed)
npx tsx .e2e-plans/scripts/my-workflow.spec.ts
```

### Responsive Testing Template

```typescript
const VIEWPORTS = [
  { name: "Desktop", width: 1280, height: 720 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Mobile", width: 375, height: 812 },
];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  console.log(`\nTesting: ${vp.name} (${vp.width}x${vp.height})`);

  // Run workflow steps for each viewport...

  // Check for overflow issues
  const hasHScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  const hasVScroll = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight,
  );
  if (hasHScroll) console.error(`  ✗ Horizontal overflow at ${vp.name}`);
  if (hasVScroll) console.warn(`  ⚠ Vertical scroll at ${vp.name}`);

  await page.screenshot({
    path: `.e2e-plans/screenshots/${vp.name.toLowerCase()}.png`,
    fullPage: true,
  });
}
```

## Phase B: Guided Code Execution

Use Phase B when the workflow has mostly specific selectors but a few vague steps, or when you need more control than a script but don't want full interactivity.

Use `playwright_browser_run_code_unsafe` to run inline Playwright code:

```javascript
// Navigate and validate in one shot
await page.goto(APP_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="main-content"]');
const title = await page.textContent("h1");
console.log("Page title:", title);
await page.screenshot({
  path: ".e2e-plans/screenshots/phase-b-check.png",
  fullPage: true,
});
```

This gives you the speed of automated execution with the flexibility to adjust on the fly. You can iterate quickly: run code, inspect results, modify, and re-run without generating script files.

## Phase C: Interactive Fallback

### When to Fall Back

Use Phase C when:

- Steps have vague selectors ("the login button" without specifics)
- Steps require visual judgment ("verify layout looks correct")
- Authentication is interactive (user must log in manually)
- A Phase A script failed and the cause is unclear
- The workflow involves unpredictable elements (CAPTCHA, MFA, OAuth)

### Available Playwright Browser Tools

```
Navigation:
  playwright_browser_navigate({ url })           — Go to URL
  playwright_browser_navigate_back({})           — Go back
  playwright_browser_tabs({ action: "list|new|close|select" })

Interaction:
  playwright_browser_click({ target })           — Click element
  playwright_browser_type({ target, text })      — Type into field
  playwright_browser_fill_form({ fields })       — Fill multiple fields
  playwright_browser_select_option({ target, values })  — Select dropdown
  playwright_browser_hover({ target })           — Hover over element
  playwright_browser_press_key({ key })          — Press keyboard key
  playwright_browser_drag({ startTarget, endTarget })  — Drag & drop
  playwright_browser_drop({ target, paths/data })      — Drop files/data
  playwright_browser_file_upload({ paths })      — Upload files

Capture:
  playwright_browser_snapshot({})                — Accessibility tree
  playwright_browser_take_screenshot({ type })   — Visual screenshot

Diagnostics:
  playwright_browser_console_messages({ level })  — Console logs
  playwright_browser_network_requests({ static }) — Network requests
  playwright_browser_network_request({ index })   — Full request details
  playwright_browser_evaluate({ function })       — Run JS in page

State:
  playwright_browser_resize({ width, height })    — Resize viewport
  playwright_browser_wait_for({ text/time })      — Wait for condition
  playwright_browser_handle_dialog({ accept })    — Handle alert/confirm
  playwright_browser_run_code_unsafe({ code })    — Run arbitrary code
  playwright_browser_close({})                    — Close browser
```

### Step-by-Step Execution Pattern (Phase C)

For each step in a workflow:

1. **Read the step** from the plan document
2. **Execute the action** using browser tools (click, type, navigate, etc.)
3. **Wait** for expected condition (element visible, URL change, timeout)
4. **Validate** by snapshot/checking for expected elements, text, or URL
5. **Capture** screenshot to `.e2e-plans/screenshots/<run-id>/step-<n>.png`
6. **Log** result to console AND to `.e2e-plans/results/<plan>-results.md`
7. **On failure**: apply the chosen issue handling strategy

## Cleanup Best Practices

Every workflow MUST clean up after itself. After test execution:

```javascript
// Logout if the workflow logged in
const logoutBtn = page.locator(
  'button:has-text("Logout"), a:has-text("Sign out")',
);
if (await logoutBtn.isVisible()) {
  await logoutBtn.click();
  await page.waitForURL("**/login**");
}

// Navigate to a clean state
await page.goto("about:blank");
```

## Screenshot Management

```typescript
import path from "path";
import fs from "fs";

const screenshotDir = ".e2e-plans/screenshots";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(screenshotDir, runId);
fs.mkdirSync(runDir, { recursive: true });

// Capture at key steps
await page.screenshot({
  path: path.join(runDir, `${workflowName}-step-${n}.png`),
  fullPage: true,
});

// On failure — capture with FAILED marker
await page.screenshot({
  path: path.join(runDir, `${workflowName}-step-${n}-FAILED.png`),
  fullPage: true,
});
```

## Result Logging

After each workflow, append results to `.e2e-plans/results/<plan-name>-results.md`:

```markdown
## <Workflow Name>

| Step | Name            | Result  | Details                                      |
| ---- | --------------- | ------- | -------------------------------------------- |
| 1    | Navigate to app | ✅ Pass | Loaded in 2.3s                               |
| 2    | Click button    | ❌ Fail | Element not found: button:has-text("Submit") |

**Summary:** 1/2 passed, 1 failed
**Screenshots:** `.e2e-plans/screenshots/<run-id>/`
```

## Issue Reporting

### Fix Immediately (for recoverable issues)

1. Diagnose: missing selector? wrong URL? element not loaded? timeout?
2. Apply the fix: update selector, add wait, adjust action
3. Re-run the step
4. If the fix fails, file an issue report

### File Issue Report

Create `.e2e-plans/issues/<workflow>-<description>.md`:

```markdown
---
title: "[Workflow Name] — [Brief issue description]"
workflow: "[Workflow Name]"
step: [Step number]
date: "[YYYY-MM-DD]"
---

## Description

[What went wrong — 2-3 sentences]

## Steps to Reproduce

1. [Step 1 from the workflow that led to the issue]
2. [Step 2]
3. [Step N — the failing step]

## Current Behavior

[What actually happened — error message, wrong state, missing element, etc.]

## Expected Behavior

[What should have happened per the plan]

## Evidence

- Screenshot: `.e2e-plans/screenshots/<run-id>/<workflow>-step-<n>-FAILED.png`
- Viewport: [e.g. 1280x720]
- URL: [URL where the issue occurred]

## Browser Console Errors
```

[Any console.error or console.warn messages captured during the failing interaction]

```

## Suggested Fix

[Based on your understanding of the codebase, suggest what might be causing the
issue and how to fix it. Include file paths and line numbers if known.]

## Environment

- Viewport: [viewport at time of failure]
- URL: [URL where the issue occurred]
- Plan Version: [Version from metadata]
```
