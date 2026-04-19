import type { BunFile } from "bun";

export async function assertFileExists(path: string): Promise<BunFile> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`File ${path} does not exist`);
  return file;
}