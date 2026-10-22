/**
 * Runs once when the Next.js server starts.
 * Hosting without AWS: seeds demo/judge accounts and starts the dawn batch timer.
 * The `NEXT_RUNTIME === "nodejs"` block form lets the Edge build drop the imports.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const { bootstrapNodeServer } = await import("./instrumentation-node");
    await bootstrapNodeServer();
  }
}
