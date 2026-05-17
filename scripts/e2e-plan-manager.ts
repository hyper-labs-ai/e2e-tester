#!/usr/bin/env npx tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MANAGER_PATH =
  process.env.E2E_PLAN_MANAGER_PATH ||
  `npx tsx ${path.resolve(__dirname, "e2e-plan-manager.ts")}`;

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// function findProjectRoot(): string {
//   let dir = process.cwd();
//   while (dir !== "/") {
//     if (
//       fs.existsSync(path.join(dir, "package.json")) ||
//       fs.existsSync(path.join(dir, ".git"))
//     ) {
//       return dir;
//     }
//     dir = path.dirname(dir);
//   }
//   return process.cwd();
// }

function plansDir(): string {
  return path.resolve(process.cwd(), ".e2e-plans");
}

interface PlanMeta {
  name: string;
  file: string;
  version: string;
  workflows: number;
  hasHappyPath: boolean;
  lines: number;
}

interface WorkflowBlock {
  name: string;
  steps: number;
  edgeCases: number;
  hasCleanup: boolean;
}

export function parsePlanMeta(filePath: string): PlanMeta {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const name = path.basename(filePath, ".md");

  const versionMatch = content.match(/\*\*Version\*\*\s*[|:`]\s*([^\s|]+)/);
  const version = versionMatch?.[1] ?? "unknown";

  const workflowMatches = content.match(/### Workflow \d+:/g);
  const workflows = workflowMatches?.length ?? 0;

  const hasHappy =
    content.includes("#### Happy Path") ||
    content.includes("#### Detailed Steps");

  return {
    name,
    file: path.basename(filePath),
    version,
    workflows,
    hasHappyPath: hasHappy,
    lines: lines.length,
  };
}

export function parseWorkflows(filePath: string): WorkflowBlock[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const workflows: WorkflowBlock[] = [];
  let current: WorkflowBlock | null = null;
  let stepCount = 0;
  let edgeCount = 0;
  let hasCleanup = false;

  for (const line of lines) {
    const wfMatch = line.match(/^### Workflow \d+:\s*(.+)$/);
    if (wfMatch) {
      if (current) {
        current.steps = stepCount;
        current.edgeCases = edgeCount;
        current.hasCleanup = hasCleanup;
        workflows.push(current);
      }
      current = {
        name: wfMatch?.[1]?.trim() || `Workflow ${workflows.length + 1}`,
        steps: 0,
        edgeCases: 0,
        hasCleanup: false,
      };
      stepCount = 0;
      edgeCount = 0;
      hasCleanup = false;
      continue;
    }
    if (
      line.match(/^\*\*Step \d+:/) ||
      line.match(/^`Step \d+:`/) ||
      line.match(/^\|?\s*\d+\s*\|/)
    ) {
      stepCount++;
    }
    if (line.match(/^\*\*Edge Case \d+:/) || line.match(/^Edge Case \d+:/)) {
      edgeCount++;
    }
    if (line.includes("#### Cleanup") || line.includes("## Cleanup")) {
      hasCleanup = true;
    }
  }
  if (current) {
    current.steps = stepCount;
    current.edgeCases = edgeCount;
    current.hasCleanup = hasCleanup;
    workflows.push(current);
  }
  return workflows;
}

function cmdList() {
  const dir = plansDir();
  if (!fs.existsSync(dir)) {
    console.log(`${YELLOW}No .e2e-plans/ directory found.${RESET}`);
    console.log(
      `Run ${CYAN}npx tsx ${__dirname}/e2e-plan-manager.ts scaffold${RESET} to create one.`,
    );
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md");
  const planFiles = files.filter((f) => f !== "README.md");
  const readmePath = path.join(dir, "README.md");

  if (planFiles.length === 0) {
    console.log(`${YELLOW}No E2E test plans found in .e2e-plans/.${RESET}`);
    return;
  }

  console.log(
    `\n${BOLD}${BLUE}E2E Test Plans in ${path.resolve(process.cwd(), ".e2e-plans")}${RESET}\n`,
  );

  const metas: PlanMeta[] = [];
  for (const f of planFiles) {
    metas.push(parsePlanMeta(path.join(dir, f)));
  }

  const totalWorkflows = metas.reduce((s, m) => s + m.workflows, 0);

  console.log(
    `${BOLD}${padRight("Plan", 28)} ${padRight("Version", 10)} ${padRight("Workflows", 12)} ${padRight("Status", 10)} ${padRight("Lines", 8)}${RESET}`,
  );
  console.log("-".repeat(70));

  for (const meta of metas) {
    const status = meta.hasHappyPath
      ? `${GREEN}✓ ready${RESET}`
      : `${YELLOW}⚠ incomplete${RESET}`;
    console.log(
      `${padRight(meta.file.replace(".md", ""), 28)} ${padRight(meta.version, 10)} ${padRight(String(meta.workflows), 12)} ${status} ${padRight(String(meta.lines), 8)}`,
    );
  }

  console.log(
    `\n${CYAN}Total: ${metas.length} plan(s) with ${totalWorkflows} workflow(s)${RESET}`,
  );

  if (fs.existsSync(readmePath)) {
    console.log(`${GREEN}README index found${RESET}`);
  } else {
    console.log(
      `${YELLOW}No README index — run 'e2e-plan-manager.ts index' to generate${RESET}`,
    );
  }

  console.log();
}

function cmdShow(planName: string) {
  if (!planName) {
    console.error(`${RED}Error: Plan name required${RESET}`);
    console.log(`Usage: e2e-plan-manager.ts show <plan-name>`);
    process.exit(1);
  }
  const dir = plansDir();
  const filePath = path.join(dir, `${planName}.md`);
  if (!fs.existsSync(filePath)) {
    console.error(
      `${RED}Error: Plan '${planName}' not found in .e2e-plans/${RESET}`,
    );
    return;
  }

  const meta = parsePlanMeta(filePath);
  const workflows = parseWorkflows(filePath);

  console.log(`\n${BOLD}${BLUE}Plan: ${meta.name}${RESET}\n`);
  console.log(`${BOLD}File:${RESET}     .e2e-plans/${meta.file}`);
  console.log(`${BOLD}Version:${RESET}  ${meta.version}`);
  console.log(`${BOLD}Workflows:${RESET} ${meta.workflows}`);
  console.log(`${BOLD}Lines:${RESET}    ${meta.lines}\n`);

  if (workflows.length > 0) {
    console.log(
      `${BOLD}${padRight("Workflow", 40)} ${padRight("Steps", 8)} ${padRight("Edge Cases", 12)} ${padRight("Cleanup", 10)}${RESET}`,
    );
    console.log("-".repeat(72));
    for (const wf of workflows) {
      const cleanup = wf.hasCleanup
        ? `${GREEN}✓${RESET}`
        : `${YELLOW}✗${RESET}`;
      console.log(
        `${padRight(wf.name, 40)} ${padRight(String(wf.steps), 8)} ${padRight(String(wf.edgeCases), 12)} ${cleanup}`,
      );
    }
    console.log();
  }
}

function cmdScaffold() {
  const dir = plansDir();
  if (fs.existsSync(dir)) {
    console.log(`${YELLOW}.e2e-plans/ already exists at ${dir}${RESET}`);
    return;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "results"), { recursive: true });
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "screenshots"), { recursive: true });

  const readme = `# E2E Test Plans

This directory contains End-to-End (E2E) test plans for this project.

## Structure

\`\`\`
.e2e-plans/
├── README.md              # This file — index of all plans
├── *.md                   # Individual plan files
├── results/               # Test execution reports
├── scripts/               # Generated Playwright test scripts
└── screenshots/           # Screenshots captured during execution
\`\`\`

## Plans

<!-- Plans will be listed here by the e2e-plan-manager index command -->

## Usage

\`\`\`bash
# List all plans
${MANAGER_PATH} list

# Show details of a specific plan
${MANAGER_PATH} show <plan-name>

# Re-generate this index
${MANAGER_PATH} index
\`\`\`
`;

  fs.writeFileSync(path.join(dir, "README.md"), readme, "utf-8");

  console.log(`${GREEN}Created .e2e-plans/ structure at ${dir}${RESET}`);
  console.log(`  ${CYAN}.e2e-plans/README.md${RESET}`);
  console.log(`  ${CYAN}.e2e-plans/results/${RESET}`);
  console.log(`  ${CYAN}.e2e-plans/scripts/${RESET}`);
  console.log(`  ${CYAN}.e2e-plans/screenshots/${RESET}`);
}

function cmdIndex() {
  const dir = plansDir();
  if (!fs.existsSync(dir)) {
    console.log(
      `${YELLOW}No .e2e-plans/ directory found. Run 'scaffold' first.${RESET}`,
    );
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md");
  if (files.length === 0) {
    console.log(
      `${YELLOW}No plan files found in .e2e-plans/. Nothing to index.${RESET}`,
    );
    return;
  }

  const metas = files.map((f) => parsePlanMeta(path.join(dir, f)));
  const totalWorkflows = metas.reduce((s, m) => s + m.workflows, 0);

  let planList = "";
  for (const meta of metas) {
    planList += `- [${meta.name}](${meta.file}) — v${meta.version}, ${meta.workflows} workflow(s), ${meta.lines} lines\n`;
  }

  const readmePath = path.join(dir, "README.md");
  const timestamp = new Date().toISOString().split("T")[0];

  const content = `# E2E Test Plans

*Last indexed: ${timestamp}*

This directory contains End-to-End (E2E) test plans for this project.

## Summary

- **Total plans**: ${metas.length}
- **Total workflows**: ${totalWorkflows}
- **Generated**: ${timestamp}

## Structure

\`\`\`
.e2e-plans/
├── README.md              # This file — index of all plans
├── *.md                   # Individual plan files
├── results/               # Test execution reports
├── scripts/               # Generated Playwright test scripts
└── screenshots/           # Screenshots captured during execution
\`\`\`

## Plans

${planList}
## Usage

\`\`\`bash
# List all plans
${MANAGER_PATH} list

# Show details of a specific plan
${MANAGER_PATH} show <plan-name>

# Re-generate this index
${MANAGER_PATH} index
\`\`\`
`;

  fs.writeFileSync(readmePath, content, "utf-8");
  console.log(`${GREEN}Updated README index at ${readmePath}${RESET}`);
  console.log(
    `Indexed ${metas.length} plan(s) with ${totalWorkflows} workflow(s)`,
  );
}

function cmdCheck() {
  const dir = plansDir();
  if (!fs.existsSync(dir)) {
    console.log("absent");
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md");
  if (files.length === 0) {
    console.log("empty");
    return;
  }
  for (const f of files) {
    console.log(f.replace(".md", ""));
  }
}

function cmdValidate(planName?: string) {
  const dir = plansDir();
  if (!fs.existsSync(dir)) {
    console.error(`${RED}No .e2e-plans/ directory found${RESET}`);
    process.exit(1);
  }

  const files = planName
    ? [path.join(dir, `${planName}.md`)]
    : fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .map((f) => path.join(dir, f));

  let validCount = 0;
  let issueCount = 0;

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(
        `${RED}✗ ${path.basename(filePath)} — file not found${RESET}`,
      );
      issueCount++;
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const issues: string[] = [];

    if (!content.includes("## 1. Metadata"))
      issues.push("Missing Metadata section");
    if (!content.includes("## 2. Project Overview"))
      issues.push("Missing Project Overview section");
    if (!content.includes("## 3. Testing Configuration"))
      issues.push("Missing Testing Configuration section");
    if (!content.includes("## 4. Workflows"))
      issues.push("Missing Workflows section");
    if (!content.includes("### Workflow "))
      issues.push("No Workflow definitions found");
    if (
      !content.includes("#### Happy Path") &&
      !content.includes("#### Detailed Steps")
    )
      issues.push("No Happy Path steps found");
    if (!content.includes("## 5. Issue Reporting"))
      issues.push("Missing Issue Reporting section");

    if (issues.length === 0) {
      console.log(`${GREEN}✓ ${path.basename(filePath)} — valid${RESET}`);
      validCount++;
    } else {
      console.log(
        `${YELLOW}⚠ ${path.basename(filePath)} — ${issues.length} issue(s):${RESET}`,
      );
      for (const issue of issues) {
        console.log(`   ${RED}•${RESET} ${issue}`);
      }
      issueCount++;
    }
  }

  console.log(`\n${validCount} valid, ${issueCount} with issues`);
}

export function analyzeRouting(content: string): {
  phase: string;
  reason: string;
} {
  const vaguePatterns = [
    /\bthe (login|submit|register|button|link|form|menu)\b/i,
    /\b(verify|check|ensure|validate)\s+(layout|appearance|visual|look)/i,
    /\b(manually|interactive|judgment)\b/i,
    /CAPTCHA|MFA|OAuth|2FA/i,
  ];

  const specificPatterns = [
    /data-testid|data-test|aria-label/i,
    /\[.*\]|#\w+|\.\w+/,
    /button:text|page\.\w+|input\[/i,
    /waitFor|waitForSelector|waitForURL|waitForLoadState/i,
  ];

  const lower = content.toLowerCase();
  const vagueHits = vaguePatterns.filter((r) => r.test(content)).length;
  const specificHits = specificPatterns.filter((r) => r.test(content)).length;

  if (vagueHits > 0 && specificHits === 0) {
    return {
      phase: "B",
      reason:
        "Steps contain vague selectors/instructions without specific alternatives; falls back to interactive control.",
    };
  }
  if (content.includes("CAPTCHA") || content.includes("MFA")) {
    return {
      phase: "B",
      reason:
        "Unpredictable elements (CAPTCHA/MFA/OAuth) require interactive handling.",
    };
  }
  if (vagueHits > specificHits) {
    return {
      phase: "B",
      reason:
        "More vague patterns than specific selectors; recommended to use interactive fallback.",
    };
  }
  return {
    phase: "A",
    reason:
      "Steps appear well-defined with specific selectors; suitable for Playwright script generation.",
  };
}

function cmdRoute(planName?: string) {
  const dir = plansDir();
  if (!fs.existsSync(dir)) {
    console.log(`${YELLOW}No .e2e-plans/ directory found.${RESET}`);
    console.log(`Run ${CYAN}scaffold${RESET} first to create one.`);
    return;
  }

  const files = planName
    ? [path.join(dir, `${planName}.md`)]
    : fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .map((f) => path.join(dir, f));

  if (files.length === 0) {
    console.log(`${YELLOW}No plan files found. Nothing to route.${RESET}`);
    return;
  }

  console.log(`\n${BOLD}${BLUE}Hybrid Execution Routing${RESET}\n`);
  console.log(
    `${CYAN}Phase A${RESET} = Playwright script generation  |  ${CYAN}Phase B${RESET} = Interactive browser control\n`,
  );

  for (const filePath of files) {
    const meta = parsePlanMeta(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const routing = analyzeRouting(content);

    console.log(
      `${BOLD}${meta.name}${RESET} → ${routing.phase === "A" ? `${GREEN}Phase ${routing.phase}${RESET}` : `${YELLOW}Phase ${routing.phase}${RESET}`}`,
    );
    console.log(`  ${routing.reason}`);

    const workflows = parseWorkflows(filePath);
    if (workflows.length > 0) {
      console.log(`  ${CYAN}Workflows:${RESET}`);
      for (const wf of workflows) {
        console.log(
          `    • ${wf.name} (${wf.steps} steps, ${wf.edgeCases} edge cases)`,
        );
      }
    }
    console.log();
  }
}

export function padRight(s: string, n: number): string {
  return s.length < n ? s + " ".repeat(n - s.length) : s.substring(0, n);
}

function printUsage() {
  console.log(`
${BLUE}E2E Plan Manager${RESET}
${CYAN}Usage:${RESET}
    npx tsx ${__dirname}/e2e-plan-manager.ts <command> [options]

${CYAN}Commands:${RESET}
    ${GREEN}list${RESET}                    List all plans in .e2e-plans/
    ${GREEN}show${RESET} <plan-name>        Show details of a specific plan
    ${GREEN}scaffold${RESET}               Create .e2e-plans/ directory structure
    ${GREEN}index${RESET}                  Generate/update README index
    ${GREEN}check${RESET}                  Check if plans exist (output: absent|empty|list)
    ${GREEN}validate${RESET} [plan-name]   Validate plan structure (all or specific)
    ${GREEN}route${RESET} [plan-name]      Show hybrid execution routing (Phase A vs Phase B)

${CYAN}Examples:${RESET}
    npx tsx ${__dirname}/e2e-plan-manager.ts list
    npx tsx ${__dirname}/e2e-plan-manager.ts show my-plan
    npx tsx ${__dirname}/e2e-plan-manager.ts scaffold
    npx tsx ${__dirname}/e2e-plan-manager.ts index
    npx tsx ${__dirname}/e2e-plan-manager.ts check
    npx tsx ${__dirname}/e2e-plan-manager.ts validate
    npx tsx ${__dirname}/e2e-plan-manager.ts route
`);
}

const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "list":
    cmdList();
    break;
  case "show":
    cmdShow(arg as string);
    break;
  case "scaffold":
    cmdScaffold();
    break;
  case "index":
    cmdIndex();
    break;
  case "check":
    cmdCheck();
    break;
  case "validate":
    cmdValidate(arg);
    break;
  case "route":
    cmdRoute(arg);
    break;
  default:
    printUsage();
    break;
}
