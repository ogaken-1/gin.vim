import {
  autocmd,
  batch,
  Denops,
  fn,
  helper,
  option,
  unknownutil,
} from "../../deps.ts";
import {
  builtinOpts,
  formatOpts,
  parseOpts,
  validateOpts,
} from "../../util/args.ts";
import { normCmdArgs } from "../../util/cmd.ts";
import * as buffer from "../../util/buffer.ts";
import { getWorktreeFromOpts } from "../../util/worktree.ts";
import { decodeUtf8 } from "../../util/text.ts";
import { run } from "../../git/process.ts";

export async function command(
  denops: Denops,
  args: string[],
): Promise<void> {
  const [env, verbose, eventignore] = await batch.gather(
    denops,
    async (denops) => {
      await fn.environ(denops);
      await option.verbose.get(denops);
      await option.eventignore.get(denops);
    },
  );
  unknownutil.assertObject(env, unknownutil.isString);
  unknownutil.assertNumber(verbose);
  unknownutil.assertString(eventignore);
  const [opts, residue] = parseOpts(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    "buffer",
    ...builtinOpts,
  ]);
  const worktree = await getWorktreeFromOpts(denops, opts);
  const proc = run(residue, {
    printCommand: !!verbose,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    noOptionalLocks: true,
    cwd: worktree,
    env,
  });
  const [status, stdout, stderr] = await Promise.all([
    proc.status(),
    proc.output(),
    proc.stderrOutput(),
  ]);
  proc.close();
  if ("buffer" in opts) {
    const cmdarg = formatOpts(opts, builtinOpts).join(" ");
    await denops.cmd("noswapfile enew");
    const bufnr = await fn.bufnr(denops);
    await buffer.ensure(denops, bufnr, async () => {
      await batch.batch(denops, async (denops) => {
        await option.modifiable.setLocal(denops, false);
      });
      await buffer.editData(denops, new Uint8Array([...stdout, ...stderr]), {
        mods: "silent keepalt keepjumps",
        cmdarg,
      });
    });
    await buffer.concrete(denops, bufnr);
  } else {
    if (status.success) {
      await helper.echo(denops, decodeUtf8(stdout) + decodeUtf8(stderr));
    } else {
      await helper.echoerr(denops, decodeUtf8(stdout) + decodeUtf8(stderr));
    }
  }
  if (status.success && !eventignore.includes("all")) {
    await autocmd.emit(denops, "User", "GinCommandPost", {
      nomodeline: true,
    });
  }
}

export async function bind(denops: Denops, bufnr: number): Promise<void> {
  await autocmd.group(denops, `gin_bare_command_bind_${bufnr}`, (helper) => {
    helper.remove();
    helper.define(
      "User",
      "GinCommandPost",
      `call gin#util#reload(${bufnr})`,
    );
  });
}
