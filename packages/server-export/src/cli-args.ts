import path from "node:path";
import type { ExportProjectFileOptions } from "./types.js";

export interface ParsedCliArgs {
  projectPath: string;
  options: ExportProjectFileOptions;
  quiet: boolean;
}

/** Pure and unit-testable: argv (after node + script) → validated options. */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  let projectPath: string | undefined;
  const assets: Record<string, string> = {};
  let out: string | undefined;
  let format: "mp4" | "webm" | undefined;
  let quality: "draft" | "standard" | "high" | undefined;
  let fps: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let startS: number | undefined;
  let endS: number | undefined;
  let assetsDir: string | undefined;
  let browserPath: string | undefined;
  let quiet = false;

  const takeValue = (flag: string, value: string | undefined): string => {
    if (value === undefined) throw new Error(`${flag} needs a value`);
    return value;
  };
  const takeNumber = (flag: string, value: string | undefined): number => {
    const n = Number(takeValue(flag, value));
    if (!Number.isFinite(n) || n < 0) throw new Error(`${flag} needs a non-negative number`);
    return n;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
      case "-o":
        out = takeValue(arg, argv[++i]);
        break;
      case "--format":
        format = takeValue(arg, argv[++i]) as "mp4" | "webm";
        if (format !== "mp4" && format !== "webm") throw new Error(`--format must be mp4 or webm`);
        break;
      case "--quality":
        quality = takeValue(arg, argv[++i]) as "draft" | "standard" | "high";
        if (!["draft", "standard", "high"].includes(quality))
          throw new Error(`--quality must be draft, standard, or high`);
        break;
      case "--fps":
        fps = takeNumber(arg, argv[++i]);
        break;
      case "--width":
        width = takeNumber(arg, argv[++i]);
        break;
      case "--height":
        height = takeNumber(arg, argv[++i]);
        break;
      case "--start":
        startS = takeNumber(arg, argv[++i]);
        break;
      case "--end":
        endS = takeNumber(arg, argv[++i]);
        break;
      case "--asset": {
        const pair = takeValue(arg, argv[++i]);
        const eq = pair.indexOf("=");
        if (eq <= 0) throw new Error(`--asset needs id=path, got "${pair}"`);
        assets[pair.slice(0, eq)] = pair.slice(eq + 1);
        break;
      }
      case "--assets-dir":
        assetsDir = takeValue(arg, argv[++i]);
        break;
      case "--browser":
        browserPath = takeValue(arg, argv[++i]);
        break;
      case "--quiet":
        quiet = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`unknown flag ${arg}`);
        if (projectPath !== undefined) throw new Error(`unexpected argument ${arg}`);
        projectPath = arg;
    }
  }

  if (!projectPath) throw new Error("usage: miraiclip-export <project.json> --out <file>");
  if (!out) throw new Error("--out is required");
  const inferredFormat =
    format ?? (path.extname(out).toLowerCase() === ".webm" ? "webm" : "mp4");
  if ((startS === undefined) !== (endS === undefined))
    throw new Error("--start and --end must be given together");

  const options: ExportProjectFileOptions = {
    format: inferredFormat,
    out,
    ...(quality !== undefined ? { quality } : {}),
    ...(fps !== undefined ? { fps } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(startS !== undefined && endS !== undefined
      ? { range: { startUs: Math.round(startS * 1e6), endUs: Math.round(endS * 1e6) } }
      : {}),
    ...(Object.keys(assets).length > 0 ? { assets } : {}),
    ...(assetsDir !== undefined ? { assetsDir } : {}),
    ...(browserPath !== undefined ? { browser: { executablePath: browserPath } } : {}),
  };
  return { projectPath, options, quiet };
}
