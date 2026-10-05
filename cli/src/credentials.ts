import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CliError } from "./errors";

// Session tokens live in one file in the user's config directory, readable by its owner only,
// keyed by server URL, so a token is only ever sent to the server that issued it.

const credentialsSchema = z.object({
  servers: z.record(z.string(), z.object({ token: z.string() })),
});
type Credentials = z.infer<typeof credentialsSchema>;

/** `$XDG_CONFIG_HOME/todo-cat`, `%APPDATA%\todo-cat` on Windows, else `~/.config/todo-cat`. */
export function configDir(): string {
  const { XDG_CONFIG_HOME, APPDATA } = process.env;
  if (XDG_CONFIG_HOME) return join(XDG_CONFIG_HOME, "todo-cat");
  if (process.platform === "win32" && APPDATA) return join(APPDATA, "todo-cat");
  return join(homedir(), ".config", "todo-cat");
}

export function credentialsFile(): string {
  return join(configDir(), "credentials.json");
}

async function load(): Promise<Credentials> {
  let text: string;
  try {
    text = await readFile(credentialsFile(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { servers: {} };
    }
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const parsed = credentialsSchema.safeParse(json);
  if (!parsed.success) {
    throw new CliError(
      "unexpected-response",
      `${credentialsFile()} is damaged; delete it and log in again`,
    );
  }
  return parsed.data;
}

async function save(credentials: Credentials): Promise<void> {
  const file = credentialsFile();
  if (Object.keys(credentials.servers).length === 0) {
    await rm(file, { force: true });
    return;
  }
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  // A fresh file created with mode 0600, then renamed over the old one: never briefly readable.
  const temp = `${file}.${process.pid}.tmp`;
  await rm(temp, { force: true });
  await writeFile(temp, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  await rename(temp, file);
}

export async function readToken(server: string): Promise<string | undefined> {
  return (await load()).servers[server]?.token;
}

export async function writeToken(server: string, token: string): Promise<void> {
  const credentials = await load();
  credentials.servers[server] = { token };
  await save(credentials);
}

export async function deleteToken(server: string): Promise<void> {
  const credentials = await load();
  delete credentials.servers[server];
  await save(credentials);
}
