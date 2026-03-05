export function log(module: string, event: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    module,
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}
