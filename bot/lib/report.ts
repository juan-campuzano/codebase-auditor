import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Severity } from "./rules.js";

export type Finding = {
  ruleId: string;
  stack: string;
  severity: Severity;
  repoId: string;
  file: string;
  line?: number;
  title: string;
  detail: string;
  evidence?: string;
};

export type AuditReport = {
  auditId: string;
  createdAt: string;
  rulesPath: string;
  repos: string[];
  stacks: string[];
  findings: Finding[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byRepo: Record<string, number>;
    byStack: Record<string, number>;
  };
};

function emptySummary(): AuditReport["summary"] {
  return {
    total: 0,
    bySeverity: { high: 0, medium: 0, low: 0 },
    byRepo: {},
    byStack: {},
  };
}

export function summarize(findings: Finding[]): AuditReport["summary"] {
  const summary = emptySummary();
  summary.total = findings.length;
  for (const finding of findings) {
    summary.bySeverity[finding.severity] += 1;
    summary.byRepo[finding.repoId] = (summary.byRepo[finding.repoId] ?? 0) + 1;
    summary.byStack[finding.stack] = (summary.byStack[finding.stack] ?? 0) + 1;
  }
  return summary;
}

export function reportDir(workspaceDir: string, auditId: string): string {
  return path.join(workspaceDir, "audits", auditId);
}

export function findingsPath(workspaceDir: string, auditId: string): string {
  return path.join(reportDir(workspaceDir, auditId), "findings.jsonl");
}

export function reportJsonPath(workspaceDir: string, auditId: string): string {
  return path.join(reportDir(workspaceDir, auditId), "report.json");
}

export function reportMarkdownPath(
  workspaceDir: string,
  auditId: string,
): string {
  return path.join(reportDir(workspaceDir, auditId), "report.md");
}

export async function appendFinding(
  workspaceDir: string,
  auditId: string,
  finding: Finding,
): Promise<void> {
  const dir = reportDir(workspaceDir, auditId);
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify(finding) + "\n";
  await writeFile(findingsPath(workspaceDir, auditId), line, { flag: "a" });
}

export async function readFindings(
  workspaceDir: string,
  auditId: string,
): Promise<Finding[]> {
  try {
    const raw = await readFile(findingsPath(workspaceDir, auditId), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Finding);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export function renderMarkdown(report: AuditReport): string {
  const lines: string[] = [
    `# Codebase audit report`,
    ``,
    `- Audit id: \`${report.auditId}\``,
    `- Created: ${report.createdAt}`,
    `- Rules: \`${report.rulesPath}\``,
    `- Repos: ${report.repos.map((r) => `\`${r}\``).join(", ") || "(none)"}`,
    `- Stacks: ${report.stacks.join(", ") || "(all)"}`,
    `- Findings: **${report.summary.total}** (high ${report.summary.bySeverity.high}, medium ${report.summary.bySeverity.medium}, low ${report.summary.bySeverity.low})`,
    ``,
  ];

  if (report.findings.length === 0) {
    lines.push(`No findings.`);
    return lines.join("\n");
  }

  const byRepo = new Map<string, Finding[]>();
  for (const finding of report.findings) {
    const list = byRepo.get(finding.repoId) ?? [];
    list.push(finding);
    byRepo.set(finding.repoId, list);
  }

  for (const [repoId, findings] of [...byRepo.entries()].sort()) {
    lines.push(`## ${repoId}`);
    lines.push(``);
    for (const finding of findings) {
      const loc =
        finding.line != null
          ? `${finding.file}:${finding.line}`
          : finding.file;
      lines.push(
        `### [${finding.severity}] ${finding.title} (\`${finding.ruleId}\`)`,
      );
      lines.push(``);
      lines.push(`- Stack: ${finding.stack}`);
      lines.push(`- Location: \`${loc}\``);
      lines.push(`- Detail: ${finding.detail}`);
      if (finding.evidence) {
        lines.push(``);
        lines.push("```");
        lines.push(finding.evidence);
        lines.push("```");
      }
      lines.push(``);
    }
  }

  return lines.join("\n");
}

export async function writeFinalReport(
  workspaceDir: string,
  report: AuditReport,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const dir = reportDir(workspaceDir, report.auditId);
  await mkdir(dir, { recursive: true });
  const jsonPath = reportJsonPath(workspaceDir, report.auditId);
  const markdownPath = reportMarkdownPath(workspaceDir, report.auditId);
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(markdownPath, renderMarkdown(report) + "\n", "utf8");
  return { jsonPath, markdownPath };
}
