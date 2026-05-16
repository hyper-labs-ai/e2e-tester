# E2E Test Execution Guide

Reference document for the **E2E Tester** agent when executing tests in **EXECUTE MODE**.

## Hybrid Execution Approach

Tests are executed using a two-phase hybrid approach:

1. **Phase A: Script Generation** — Generate a Playwright `.spec.ts` file from the plan
2. **Phase B: Interactive Fallback** — Fall back to interactive browser control when scripts can't handle the scenario

## Phase A: Script Generation

### When to Generate Scripts

Generate Playwright test scripts when ALL of these are true:

- Every step in the workflow has a clear, specific selector
- Actions are well-defined (click, type, select, navigate)
- Expected outcomes are concrete (element visible, text present, URL changed)
- Authentication is static (env file) or not required

### Script Template

```typescript
import { chromium, Browser, Page } from "playwright";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: Array<{
    step: number;
    name: string;
    passed: boolean;
    error?: string;
  }> = [];

  async function step(n: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ step: n, name, passed: true });
      console.log(`  ✓ Step ${n}: ${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ step: n, name, passed: false, error: msg });
      console.error(`  ✗ Step ${n}: ${name} — ${msg}`);
    }
  }

  try {
    await step(1, "Navigate to app", async () => {
      await page.goto(APP_URL, { waitUntil: "networkidle" });
    });

    await step(2, "Click primary button", async () => {
      await page.click('button:has-text("Get Started")');
      await page.waitForURL("**/welcome");
    });

    // ... workflow-specific steps from the plan ...
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

### Running Scripts

```bash
# Set the target URL (override default)
export APP_URL=http://localhost:3000

# Install Playwright if needed
npx playwright install chromium

# Run the test
npx tsx .e2e-plans/scripts/my-workflow.spec.ts

# Or if using Playwright test runner
npx playwright test .e2e-plans/scripts/
```

### Responsive Testing in Scripts

```typescript
const VIEWPORTS = [
  { name: "Desktop", width: 1280, height: 720 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Mobile", width: 375, height: 812 },
];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  console.log(`\nTesting: ${vp.name} (${vp.width}x${vp.height})`);

  // Run workflow steps from the plan...

  const hasHScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (hasHScroll) {
    console.error(`  ✗ Horizontal scrollbar at ${vp.name}`);
  }

  await page.screenshot({
    path: `.e2e-plans/screenshots/${vp.name.toLowerCase()}.png`,
    fullPage: true,
  });
}
```

## Phase B: Interactive Fallback

### When to Fall Back

Fall back to interactive browser control when:

- Steps have vague selectors (e.g., "the login button" without a specific selector)
- Steps require visual judgment (e.g., "verify the layout looks correct")
- Authentication is interactive (user must log in manually)
- A generated script fails and the cause is unclear
- The workflow involves unpredictable elements (CAPTCHA, MFA, OAuth redirects)

### Using Playwright Browser Tools

Use the available Playwright browser tools to control the browser interactively:

```javascript
// Navigation (uses APP_URL from plan or user input)
playwright_browser_navigate({ url: APP_URL });

// Interacting
playwright_browser_click({ target: "button:has-text('Login')" });
playwright_browser_type({
  target: "input[name='email']",
  text: "user@example.com",
});

// Capture state
playwright_browser_snapshot({});
playwright_browser_take_screenshot({ type: "png" });

// Console
playwright_browser_console_messages({ level: "error" });

// Network
playwright_browser_network_requests({ static: false });

// Responsive
playwright_browser_resize({ width: 768, height: 1024 });

// Handle dialogs (alerts, confirms, prompts)
playwright_browser_handle_dialog({ accept: true });
```

### Step-by-Step Execution Pattern

For each step in a workflow:

1. **Read the step** from the plan
2. **Execute the action** using browser tools (click, type, navigate, etc.)
3. **Wait** for expected condition (element, URL, timeout)
4. **Validate** by checking for expected elements, text, or URL
5. **Capture** screenshot and console messages
6. **Log** the result (pass/fail)
7. **On failure**: apply the chosen issue handling strategy

## Cleanup Best Practices

Every workflow MUST clean up after itself. The exact steps depend on what the workflow does:

```typescript
async function cleanup(page: Page) {
  // Example: delete a resource created during the test
  // (specific selectors come from the plan)
  await page.goto(`${APP_URL}/settings`);
  await page.click('[data-testid="delete-test-resource"]');
  await page.waitForSelector("text=Successfully deleted");

  // Logout if the workflow logged in
  const logoutBtn = await page.$(
    'button:has-text("Logout"), a:has-text("Sign out")',
  );
  if (logoutBtn) {
    await logoutBtn.click();
    await page.waitForURL("**/login**");
  }
}
```

## Screenshot Management

```typescript
import path from "path";
const screenshotDir = ".e2e-plans/screenshots";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(screenshotDir, runId);
fs.mkdirSync(runDir, { recursive: true });

// Capture at key steps
await page.screenshot({
  path: path.join(runDir, `${workflowName}-step-${n}.png`),
  fullPage: true,
});

// On failure
await page.screenshot({
  path: path.join(runDir, `${workflowName}-step-${n}-FAILED.png`),
  fullPage: true,
});
```

## Issue Reporting

### Fix Immediately

1. Diagnose the issue (missing selector? wrong URL? element not loaded?)
2. Apply the fix (update selector, add wait, adjust action)
3. Re-run the step
4. If the fix fails, fall back to filing an issue report

### File Issue Report

Create `.issues/<workflow>-<description>.md`:

```markdown
---
title: "[Workflow Name] - [Brief issue description]"
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

## Screenshot

![Screenshot](data:image/png;base64,...)

## Browser Console Errors
```

[Any console.error or console.warn messages captured during the failing interaction]

```

## Suggested Fix

[Based on your understanding of the codebase, suggest what might be causing the issue and how to fix it. Include file paths and line numbers if known.]

## Environment

- Viewport: [viewport at time of failure, e.g. 1280x720]
- URL: [URL where the issue occurred]
- Plan Version: [Version from metadata]
```
