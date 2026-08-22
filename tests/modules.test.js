import { describe, expect, it } from "vitest";
import { createZip, openZip, safeExtractionPath } from "../src/modules/archive/zipArchive";
import { detectAlgorithm, digest, verify } from "../src/modules/checksum/checksum";
import OperationQueue from "../src/modules/operationQueue/OperationQueue";
import { getModule, listModules, loadModule } from "../src/modules/registry";
const waitFor = (predicate, timeout = 2000) => new Promise((resolve, reject) => {
  const started = Date.now();
  const timer = setInterval(() => {
    if (predicate()) {
      clearInterval(timer);
      resolve();
    } else if (Date.now() - started > timeout) {
      clearInterval(timer);
      reject(new Error("Timed out waiting for module state"));
    }
  }, 10);
});
describe("OperationQueue", () => {
  it("runs queued operations and reports progress", async () => {
    const queue = new OperationQueue({
      concurrency: 1
    });
    const task = queue.enqueue(async ({
      report
    }) => {
      report({
        processedBytes: 5,
        totalBytes: 10
      });
      return "done";
    }, {
      type: "copy",
      title: "Copy"
    });
    await waitFor(() => queue.get(task.id)?.state === "completed");
    expect(queue.get(task.id)).toMatchObject({
      state: "completed",
      progress: 1,
      result: "done"
    });
    queue.destroy();
  });
  it("cancels queued work", async () => {
    const queue = new OperationQueue({
      concurrency: 1
    });
    const first = queue.enqueue(() => new Promise(resolve => setTimeout(resolve, 50)));
    const second = queue.enqueue(async () => "should not run");
    expect(queue.cancel(second.id)).toBe(true);
    expect(queue.get(second.id)?.state).toBe("cancelled");
    await waitFor(() => queue.get(first.id)?.state === "completed");
    queue.destroy();
  });
});
describe("ZIP archive foundation", () => {
  it("creates, lists, reads, and extracts ZIP entries", async () => {
    const data = await createZip([{
      path: "project/index.html",
      data: "<h1>LuckyBox</h1>"
    }, {
      path: "project/assets/",
      directory: true
    }], {
      type: "uint8array"
    });
    const archive = await openZip(data, {
      checkCRC32: true
    });
    expect(archive.has("project/index.html")).toBe(true);
    expect(await archive.read("project/index.html", "string")).toContain("LuckyBox");
    const extracted = [];
    await archive.extractAll(entry => extracted.push(entry.path));
    expect(extracted).toContain("project/index.html");
  });
  it("blocks ZIP Slip paths", () => {
    expect(() => safeExtractionPath("../../secret.txt")).toThrow(/Unsafe/);
  });
});
describe("Checksum foundation", () => {
  it("creates and verifies SHA-256", async () => {
    const checksum = await digest("LuckyBox", "sha256");
    expect(checksum).toHaveLength(64);
    expect(detectAlgorithm(checksum)).toBe("sha256");
    expect((await verify("LuckyBox", checksum)).matches).toBe(true);
  });
});
describe("Module registry", () => {
  it("lists all approved modules and lazy-loads foundations", async () => {
    expect(listModules().length).toBeGreaterThanOrEqual(18);
    expect(getModule("archive")?.status).toBe("foundation");
    expect(await loadModule("checksum")).toHaveProperty("digest");
  });
});
