/**
 * Durable job-status delivery — the offline journal behind the partner app's
 * live flow.
 *
 * The problem: in Shillong's hilly, low-signal terrain a driver can tap
 * "Complete delivery", the socket emit silently short-circuits, and the backend
 * never learns — COD unmarked, customer never told, cash collected invisibly.
 *
 * The fix: every status transition is WRITTEN AHEAD to AsyncStorage before the
 * UI moves on, then flushed. Flushing tries a socket emit with an ack first, then
 * a REST mirror (POST /fulfiller/job-status), and only drops the entry once the
 * server confirms it durably (the backend transition is atomic + idempotent, so
 * replays are safe). Entries are flushed oldest-first and IN ORDER — the server's
 * sequence guard requires each step's exact prior state, so en_route must land
 * before arrived. Flushing is re-triggered on reconnect and app-foreground.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocket } from './socket';
import { postJobStatus } from './api';
import { EVENTS, REQUEST_STATUS } from './constants';

const KEY = 'sw-fulfiller-jobsync';
const ACK_TIMEOUT_MS = 4000;
// Hard ceiling on a single delivery attempt. Belt-and-suspenders: even if some
// path failed to settle, the flush loop can never wedge (which would leave the
// `flushing` flag stuck true and dead-lock every future flush). REST is already
// bounded at 15s; this sits just above it.
const DELIVER_DEADLINE_MS = 18000;

// Statuses from which a queued transition can never apply (the request is done or
// gone) — drop such entries instead of retrying forever.
const TERMINAL = [
  REQUEST_STATUS.COMPLETED,
  REQUEST_STATUS.CANCELLED,
  REQUEST_STATUS.EXPIRED,
  REQUEST_STATUS.NO_FULFILLER,
];

let flushing = false;

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
}

/** Write-ahead: durably record a transition BEFORE the UI moves on. */
export async function enqueueJobStatus(requestId, status) {
  if (!requestId || !status) return;
  const id = String(requestId);
  const q = await readQueue();
  if (!q.some((e) => e.requestId === id && e.status === status)) {
    q.push({ requestId: id, status, ts: Date.now() });
    await writeQueue(q);
  }
}

/**
 * Attempt to deliver one transition.
 * @returns {Promise<'done'|'dead'|'retry'>} done = server confirmed · dead =
 *   can't ever apply (drop it) · retry = transient, keep it for the next flush.
 */
function deliver(entry) {
  return new Promise((resolve) => {
    let settled = false;
    let restStarted = false;
    const finish = (r) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };

    const classify = (result) => {
      if (result?.ok) return 'done';
      if (result?.status && TERMINAL.includes(result.status)) return 'dead';
      return 'retry';
    };

    // REST mirror — runs at most once. Both the ack-timeout AND a late socket ack
    // (with a 'retry' verdict) can reach here, so guard against a duplicate POST.
    const viaRest = async () => {
      if (restStarted) return;
      restStarted = true;
      try {
        const res = await postJobStatus({ requestId: entry.requestId, status: entry.status });
        finish(classify(res?.data?.data));
      } catch (err) {
        finish(err?.response?.status === 404 ? 'dead' : 'retry');
      }
    };

    const s = getSocket();
    if (s && s.connected) {
      const t = setTimeout(viaRest, ACK_TIMEOUT_MS);
      s.emit(EVENTS.JOB_STATUS, { requestId: entry.requestId, status: entry.status }, (ack) => {
        clearTimeout(t);
        const verdict = classify(ack);
        if (verdict === 'retry') viaRest(); // ack says transient → try the REST mirror (guarded)
        else finish(verdict);
      });
    } else {
      viaRest();
    }
  });
}

/** Flush the queue oldest-first, in order, stopping on the first retryable failure. */
export async function flushJobStatus() {
  if (flushing) return;
  flushing = true;
  try {
    let q = await readQueue();
    while (q.length) {
      // Race deliver() against a hard deadline so a pathological never-settling
      // attempt can't wedge the loop (and strand the `flushing` flag forever).
      const verdict = await Promise.race([
        deliver(q[0]),
        new Promise((res) => setTimeout(() => res('retry'), DELIVER_DEADLINE_MS)),
      ]);
      if (verdict === 'retry') break; // keep this entry + the rest; try again later
      q = q.slice(1); // 'done' or 'dead' → drop it
      await writeQueue(q);
    }
  } finally {
    flushing = false;
  }
}

/** Are there unsynced transitions? (drives a "syncing…" hint). */
export async function hasPendingJobStatus() {
  return (await readQueue()).length > 0;
}
