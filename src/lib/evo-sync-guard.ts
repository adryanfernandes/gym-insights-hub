export type EvoSyncWorker = "members" | "memberships" | "sales" | "activities";

type GuardResult = { acquired?: boolean; blocked_until?: string; reason?: string };

function headers(key: string) {
  return { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
}

export async function acquireEvoSync(
  base: string,
  key: string,
  worker: EvoSyncWorker,
  lockMinutes = 3,
) {
  const response = await fetch(`${base}/rest/v1/rpc/acquire_evo_sync`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({ p_worker: worker, p_lock_minutes: lockMinutes }),
    cache: "no-store",
  });
  // Keep deployments compatible while the migration is being applied.
  if (response.status === 404 || response.status === 400) return { acquired: true };
  if (!response.ok) throw new Error(`Falha ao adquirir trava EVO: HTTP ${response.status}`);
  const result = (await response.json()) as GuardResult;
  return { acquired: result.acquired === true, ...result };
}

export async function releaseEvoSync(base: string, key: string, worker: EvoSyncWorker) {
  await fetch(`${base}/rest/v1/rpc/release_evo_sync`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({ p_worker: worker }),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function blockEvoSync(
  base: string,
  key: string,
  worker: EvoSyncWorker,
  status: number,
  message: string,
) {
  if (status !== 423 && status !== 429) return;
  await fetch(`${base}/rest/v1/rpc/block_evo_sync`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      p_worker: worker,
      p_status: status,
      p_reason: message.slice(0, 500),
    }),
    cache: "no-store",
  }).catch(() => undefined);
}

export class EvoApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function assertEvoResponse(response: Response, body: string) {
  if (response.ok) return;
  throw new EvoApiError(
    response.status,
    `EVO API retornou HTTP ${response.status}: ${body.slice(0, 300)}`,
  );
}
