import type { Denops } from "https://deno.land/x/denops_std@v5.0.1/mod.ts";
import {
  assert,
  ensure,
  is,
} from "https://deno.land/x/unknownutil@v3.9.0/mod.ts#^";
import * as helper from "https://deno.land/x/denops_std@v5.0.1/helper/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v5.0.1/variable/mod.ts";
import {
  builtinOpts,
  formatOpts,
  parse,
  validateOpts,
} from "https://deno.land/x/denops_std@v5.0.1/argument/mod.ts";
import { normCmdArgs, parseSilent } from "../../util/cmd.ts";
import { exec } from "./command.ts";

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "patch:command": (bang, mods, args) => {
      assert(bang, is.String, { name: "bang" });
      assert(mods, is.String, { name: "mods" });
      assert(args, is.ArrayOf(is.String), { name: "args" });
      const silent = parseSilent(mods);
      return helper.ensureSilent(denops, silent, () => {
        return helper.friendlyCall(
          denops,
          () => command(denops, bang, mods, args),
        );
      });
    },
  };
}

async function command(
  denops: Denops,
  bang: string,
  mods: string,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    args = ensure(
      await vars.g.get(denops, "gin_patch_default_args", []),
      is.ArrayOf(is.String),
      {
        name: "g:gin_patch_default_args",
      },
    );
  }

  const [opts, _, residue] = parse(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    "opener",
    "no-head",
    "no-worktree",
    ...builtinOpts,
  ]);
  const [abspath] = parseResidue(residue);
  await exec(denops, abspath, {
    worktree: opts.worktree,
    noHead: "no-head" in opts,
    noWorktree: "no-worktree" in opts,
    opener: opts.opener,
    cmdarg: formatOpts(opts, builtinOpts).join(" "),
    mods,
    bang: bang === "!",
  });
}

function parseResidue(
  residue: string[],
): [string] {
  // GinPatch [{options}] {path}
  switch (residue.length) {
    case 1:
      return [residue[0]];
    default:
      throw new Error("Invalid number of arguments");
  }
}
