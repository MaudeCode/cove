type TimeoutHandler = (...args: unknown[]) => void;

interface ScheduledTimer {
  args: unknown[];
  callback: TimeoutHandler;
  dueAt: number;
  id: number;
  intervalMs: number | null;
}

export interface FakeTimers {
  advanceBy: (ms: number) => void;
  now: () => number;
  runAll: () => void;
  uninstall: () => void;
}

export function installFakeTimers(startAt = 0): FakeTimers {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const timers = new Map<number, ScheduledTimer>();
  let now = startAt;
  let nextId = 1;

  const schedule = (
    callback: TimerHandler,
    delay: number | undefined,
    intervalMs: number | null,
    args: unknown[],
  ) => {
    const id = nextId++;
    timers.set(id, {
      args,
      callback: normalizeTimerHandler(callback),
      dueAt: now + Math.max(0, delay ?? 0),
      id,
      intervalMs,
    });
    return id;
  };

  globalThis.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) =>
    schedule(callback, delay, null, args)) as typeof setTimeout;
  globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
    timers.delete(Number(id));
  }) as typeof clearTimeout;
  globalThis.setInterval = ((callback: TimerHandler, delay?: number, ...args: unknown[]) =>
    schedule(callback, delay, Math.max(0, delay ?? 0), args)) as typeof setInterval;
  globalThis.clearInterval = ((id?: ReturnType<typeof setInterval>) => {
    timers.delete(Number(id));
  }) as typeof clearInterval;

  const runDueTimers = () => {
    while (true) {
      const due = [...timers.values()]
        .filter((timer) => timer.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];

      if (!due) return;

      if (due.intervalMs == null) {
        timers.delete(due.id);
      } else {
        due.dueAt += due.intervalMs;
      }

      due.callback(...due.args);
    }
  };

  return {
    advanceBy(ms: number) {
      now += ms;
      runDueTimers();
    },
    now() {
      return now;
    },
    runAll() {
      while (timers.size > 0) {
        now = Math.min(...[...timers.values()].map((timer) => timer.dueAt));
        runDueTimers();
      }
    },
    uninstall() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
      timers.clear();
    },
  };
}

function normalizeTimerHandler(callback: TimerHandler): TimeoutHandler {
  if (typeof callback === "function") return callback as TimeoutHandler;
  return () => {
    // eslint-disable-next-line no-eval
    eval(callback);
  };
}
