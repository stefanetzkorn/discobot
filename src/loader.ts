import { Glob } from "bun";
import type { Command } from "./types.ts";

export async function loadCommands(commandsDir: string): Promise<Map<string, Command>> {
  const commands = new Map<string, Command>();
  const glob = new Glob("*.ts");

  // absolute: true is required so dynamic import() can resolve the paths.
  for await (const file of glob.scan({ cwd: commandsDir, absolute: true })) {
    const mod = (await import(file)) as { default: Command };
    commands.set(mod.default.data.name, mod.default);
  }

  return commands;
}
