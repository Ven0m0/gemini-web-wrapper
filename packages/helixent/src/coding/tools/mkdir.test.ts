import { describe, expect, it, mock, beforeEach } from "bun:test";
import { mkdirTool } from "./mkdir";
import * as fsPromises from "node:fs/promises";

mock.module("node:fs/promises", () => ({
  mkdir: mock(async () => undefined),
}));

describe("mkdirTool", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should create a directory with recursive default true", async () => {
    const result = await mkdirTool.invoke({
      description: "Create a test dir",
      path: "/test/dir",
    }, { signal: new AbortController().signal } as any);

    expect(fsPromises.mkdir).toHaveBeenCalledWith("/test/dir", { recursive: true });
    expect(result).toBe("Created directory /test/dir");
  });

  it("should create a directory with recursive explicit false", async () => {
    const result = await mkdirTool.invoke({
      description: "Create a test dir",
      path: "/test/dir/non-recursive",
      recursive: false,
    }, { signal: new AbortController().signal } as any);

    expect(fsPromises.mkdir).toHaveBeenCalledWith("/test/dir/non-recursive", { recursive: false });
    expect(result).toBe("Created directory /test/dir/non-recursive");
  });

  it("should create a directory with recursive explicit true", async () => {
    const result = await mkdirTool.invoke({
      description: "Create a test dir",
      path: "/test/dir/recursive",
      recursive: true,
    }, { signal: new AbortController().signal } as any);

    expect(fsPromises.mkdir).toHaveBeenCalledWith("/test/dir/recursive", { recursive: true });
    expect(result).toBe("Created directory /test/dir/recursive");
  });

  it("should handle errors from mkdir", async () => {
    const mockError = new Error("Permission denied");
    (fsPromises.mkdir as ReturnType<typeof mock>).mockRejectedValueOnce(mockError);

    await expect(mkdirTool.invoke({
      description: "Create a test dir",
      path: "/restricted",
    }, { signal: new AbortController().signal } as any)).rejects.toThrow("Permission denied");

    expect(fsPromises.mkdir).toHaveBeenCalledWith("/restricted", { recursive: true });
  });
});
