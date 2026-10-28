import { cp, lstat, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { matchesAny } from "./rules.js";

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".dart_tool",
  "build",
  "dist",
  "target",
  ".idea",
  ".venv",
  "__pycache__",
]);

export type ListedFile = {
  path: string;
  sizeBytes: number;
};

export async function walkFiles(
  rootDir: string,
  options?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFiles?: number;
  },
): Promise<ListedFile[]> {
  const includePatterns = options?.includePatterns ?? ["**/*"];
  const excludePatterns = options?.excludePatterns ?? [];
  const maxFiles = options?.maxFiles ?? 2000;
  const results: ListedFile[] = [];

  async function walk(current: string): Promise<void> {
    if (results.length >= maxFiles) return;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        if (entry.isDirectory()) continue;
      }
      if (entry.isDirectory() && SKIP_DIR_NAMES.has(entry.name)) continue;

      const absolute = path.join(current, entry.name);
      const relative = path.relative(rootDir, absolute).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (
          excludePatterns.length > 0 &&
          matchesAny(relative + "/", excludePatterns)
        ) {
          continue;
        }
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!matchesAny(relative, includePatterns)) continue;
      if (excludePatterns.length > 0 && matchesAny(relative, excludePatterns)) {
        continue;
      }

      const info = await stat(absolute);
      results.push({ path: relative, sizeBytes: info.size });
    }
  }

  await walk(rootDir);
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

export async function readTextFile(
  absolutePath: string,
  options?: { maxBytes?: number; maxLines?: number },
): Promise<{ content: string; truncated: boolean; lineCount: number }> {
  const maxBytes = options?.maxBytes ?? 120_000;
  const maxLines = options?.maxLines ?? 800;
  const buf = await readFile(absolutePath);
  const truncatedBytes = buf.byteLength > maxBytes;
  const text = buf.subarray(0, maxBytes).toString("utf8");
  const lines = text.split(/\r?\n/);
  const truncatedLines = lines.length > maxLines;
  const clipped = truncatedLines ? lines.slice(0, maxLines).join("\n") : text;
  const numbered = clipped
    .split(/\r?\n/)
    .map((line, i) => `${String(i + 1).padStart(4, " ")}| ${line}`)
    .join("\n");
  return {
    content: numbered,
    truncated: truncatedBytes || truncatedLines,
    lineCount: Math.min(lines.length, maxLines),
  };
}

export async function ensureEmptyDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

export async function copyTree(source: string, destination: string): Promise<void> {
  const info = await lstat(source);
  if (!info.isDirectory()) {
    throw new Error(`Source is not a directory: ${source}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, dereference: true });
}

export function safeRepoSlug(input: string): string {
  return input
    .trim()
    .replace(/\/+$/, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .slice(-2)
    .join("__")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "repo";
}
