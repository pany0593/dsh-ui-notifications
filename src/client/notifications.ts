/**
 * Notification decision logic: pure transition detection over the sessions list
 * snapshot plus the fire-time policy gate. The browser half feeds the sessions
 * list store in and calls {@link shouldNotify} before touching the Notification
 * API, so every branch here is testable without a DOM.
 */

/** The pending-interaction kinds the host reports on a session summary. */
export type PendingKind = 'approval' | 'plan-review' | 'question'

/** Per-session facts a notification cares about, projected from one list row. */
export interface SessionActivity {
  /** Whether the agent is currently working (true → false = a turn just finished). */
  running: boolean
  /** A wait for the human, set while an interaction blocks the session. */
  pendingInteraction?: PendingKind
  /** Human-facing session label used as the notification body. */
  displayTitle: string
}

/** One notification-worthy moment derived from a list transition. */
export type NotificationTrigger =
  | { kind: 'turn-end'; sessionId: string; title: string }
  | { kind: 'pending'; sessionId: string; title: string; pending: PendingKind }

/**
 * Diff two list snapshots into notification triggers. The first snapshot is a
 * baseline and never triggers (a reload or reconnect must not replay history);
 * only sessions present in BOTH snapshots can trigger, and only on a live
 * transition: running true→false, or a pending interaction appearing.
 * @param prev - previous per-session facts, or undefined for the baseline pass.
 * @param next - current per-session facts keyed by session id.
 * @returns the derived triggers and the snapshot to pass back as `prev`.
 */
export function diffActivities(
  prev: ReadonlyMap<string, SessionActivity> | undefined,
  next: Readonly<Record<string, SessionActivity>>,
): { triggers: NotificationTrigger[]; next: ReadonlyMap<string, SessionActivity> } {
  const nextMap = new Map(Object.entries(next))
  if (prev === undefined) return { triggers: [], next: nextMap }
  const triggers: NotificationTrigger[] = []
  for (const [id, activity] of nextMap) {
    const before = prev.get(id)
    if (before === undefined) continue
    if (before.running && !activity.running) {
      triggers.push({ kind: 'turn-end', sessionId: id, title: activity.displayTitle })
    }
    if (before.pendingInteraction === undefined && activity.pendingInteraction !== undefined) {
      triggers.push({
        kind: 'pending',
        sessionId: id,
        title: activity.displayTitle,
        pending: activity.pendingInteraction,
      })
    }
  }
  return { triggers, next: nextMap }
}

/** Fire-time gate inputs; the browser half reads them live on each list change. */
export interface NotifyPolicy {
  /** User toggle (settings card); off silences everything. */
  enabled: boolean
  /** Whether the page is in the background — notifications only when hidden. */
  documentHidden: boolean
  /** Browser permission state; 'unsupported' when the API is absent. */
  permission: NotificationPermission | 'unsupported'
}

/**
 * Whether a derived trigger may become a system notification.
 * @param policy - the live fire-time gate.
 * @returns true only when the user enabled notifications, the page is hidden,
 *   and the browser granted permission.
 */
export function shouldNotify(policy: NotifyPolicy): boolean {
  return policy.enabled && policy.documentHidden && policy.permission === 'granted'
}
