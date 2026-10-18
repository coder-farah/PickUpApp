/**
 * On always-on hosts like Railway, run the scheduler inside the web server once a minute
 * (TICK_IN_PROCESS=1) instead of calling /api/cron/tick from outside. Run one replica when this is on.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.TICK_IN_PROCESS !== "1") return;
  const { runTick } = await import("./server/scheduler");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runTick(new Date(), { dispatch: true });
      if (Object.values(r).some((n) => n > 0)) console.log("[tick]", JSON.stringify(r));
    } catch (err) {
      console.error("[tick] failed", err);
    } finally {
      running = false;
    }
  };
  setInterval(tick, 60_000).unref();
  setTimeout(tick, 5_000).unref();
  console.log("[tick] scheduler running every minute");
}
