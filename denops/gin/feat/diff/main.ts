import { Denops, helper, unknownutil } from "../../deps.ts";
import { command, read } from "./command.ts";

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "diff:command": (...args) => {
      unknownutil.assertArray(args, unknownutil.isString);
      return helper.friendlyCall(denops, () => command(denops, args));
    },
    "diff:read": () => read(denops),
  };
}
