// Token receipts for the language model, per run. The runner opens a context
// around each stage; every model call records its usage into that run. The
// credential itself is never part of this: only provider, model and counts.
import { AsyncLocalStorage } from "node:async_hooks";

const context = new AsyncLocalStorage();

/** Run `fn` with `run` as the current run, so model calls inside it are counted against it. */
export const runWithUsage = (run, stage, fn) => context.run({ run, stage }, fn);

/** Record one model call's usage against the current run, if any. Returns the run's running total. */
export function recordUsage({ provider, model, input = 0, output = 0, byok = false }) {
  const ctx = context.getStore();
  if (!ctx?.run) return undefined;
  const run = ctx.run;
  run.usage ??= { calls: 0, input: 0, output: 0, byok, provider, model, items: [] };
  run.usage.calls += 1;
  run.usage.input += input;
  run.usage.output += output;
  run.usage.byok = run.usage.byok || byok;
  run.usage.provider = provider ?? run.usage.provider;
  run.usage.model = model ?? run.usage.model;
  run.usage.items.push({ stage: ctx.stage, provider, model, input, output });
  if (run.usage.items.length > 20) run.usage.items.splice(0, run.usage.items.length - 20);
  return run.usage;
}

export const currentRun = () => context.getStore()?.run;
