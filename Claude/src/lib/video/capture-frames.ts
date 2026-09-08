import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import dns from "dns/promises";
import net from "net";

const execFileAsync = promisify(execFile);

const MAX_DOWNLOAD_BYTES = 300 * 1024 * 1024; // 300MB — enough for a short gameplay clip, not a feature film

/**
 * Rejects URLs that could be used to make the server fetch its own internal
 * network (SSRF): only plain http/https to a public host is allowed.
 */
async function assertSafeUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported");
  }

  const hostname = url.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("URLs pointing to localhost are not allowed");
  }

  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map((a) => a.address);

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error("URLs pointing to private/internal network addresses are not allowed");
    }
  }
}

function isPrivateOrReservedIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }
  return address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80");
}

async function downloadToTempFile(urlString: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const url = new URL(urlString);
  await assertSafeUrl(url);

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download video (${res.status})`);
  }

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("Video is too large (over 300MB)");
  }

  const dir = await mkdtemp(path.join(tmpdir(), "video-ref-"));
  const filePath = path.join(dir, "input");

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    await rm(dir, { recursive: true, force: true });
    throw new Error("Video is too large (over 300MB)");
  }
  await writeFile(filePath, buffer);

  return { filePath, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

async function probeDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine video duration");
  }
  return duration;
}

async function extractFrameAt(filePath: string, timestampSeconds: number, outDir: string): Promise<Buffer> {
  const outputPath = path.join(outDir, `${randomUUID()}.jpg`);
  await execFileAsync("ffmpeg", [
    "-ss",
    timestampSeconds.toFixed(2),
    "-i",
    filePath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    "-y",
    outputPath,
  ]);
  return readFile(outputPath);
}

export interface CapturedFrame {
  buffer: Buffer;
  timestampSeconds: number;
}

/**
 * Downloads a direct video file URL and extracts `frameCount` still frames
 * spread across the middle of its duration (skipping the very start/end,
 * which are often black frames, logos, or loading screens).
 */
export async function captureFramesFromUrl(urlString: string, frameCount = 5): Promise<CapturedFrame[]> {
  const { filePath, cleanup } = await downloadToTempFile(urlString);

  try {
    const duration = await probeDurationSeconds(filePath);
    const margin = duration * 0.05;
    const usableSpan = Math.max(duration - margin * 2, 0.1);

    const timestamps = Array.from({ length: frameCount }, (_, i) =>
      frameCount === 1 ? duration / 2 : margin + (usableSpan * i) / (frameCount - 1)
    );

    const outDir = path.dirname(filePath);
    const frames: CapturedFrame[] = [];
    for (const timestampSeconds of timestamps) {
      const buffer = await extractFrameAt(filePath, timestampSeconds, outDir);
      frames.push({ buffer, timestampSeconds });
    }
    return frames;
  } finally {
    await cleanup();
  }
}
