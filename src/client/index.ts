/**
 * System-notification plugin, browser half: watches the sessions list snapshot
 * for live transitions — an agent turn finishing (running true→false) or a
 * pending interaction appearing (approval, question, plan review) — and, only
 * while the page is hidden and the user enabled notifications, pops an
 * OS-level Notification. The settings card in the Plugins configuration tab
 * owns the enable toggle and the permission request gesture.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ui-slots Context merge (ctx.slots) and the LocaleNamespaceMap merge below.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the ui-settings SlotMap merge ('settings.general.item').
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  diffActivities,
  shouldNotify,
  type NotificationTrigger,
  type NotifyPolicy,
  type PendingKind,
  type SessionActivity,
} from './notifications.ts'
import { NotificationsRow, type NotificationsRowInjected } from './settings-row.tsx'
import { en, NS, zh, type NotificationsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** System-notification copy. */
    'ui.notifications': NotificationsKey
  }
}

/** Required services for the list subscription, the settings card, and copy. */
export const inject = ['sessions', 'slots', 'locale']

/** localStorage key for the enable toggle; survives reloads like the browser permission. */
const STORAGE_KEY = 'dsh.ui-notifications.enabled'

/** Read the persisted toggle; undefined when absent or storage is unavailable. */
function readStoredEnabled(): boolean | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'true' ? true : raw === 'false' ? false : undefined
  } catch {
    // Storage unavailable (privacy mode) — the in-memory toggle still works.
    return undefined
  }
}

/** Persist the toggle; a storage failure leaves the in-memory value authoritative. */
function writeStoredEnabled(value: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Storage unavailable (privacy mode) — the in-memory toggle still works.
  }
}

/** The locale key naming each pending-interaction kind. */
function pendingLabelKey(
  kind: PendingKind,
): 'pending.approval' | 'pending.question' | 'pending.plan-review' {
  return kind === 'approval'
    ? 'pending.approval'
    : kind === 'question'
      ? 'pending.question'
      : 'pending.plan-review'
}

/** One list row projected down to the facts the notification logic reads. */
type ActivityRow = {
  running: boolean
  displayTitle: string
  pendingInteraction?: PendingKind
  origin?: 'subagent'
}

/** The slice of the sessions list snapshot the plugin consumes. */
type ListSnapshot = { byId: Record<string, ActivityRow> }

/** Project a list snapshot into per-session activity, excluding subagent rows. */
function projectActivities(snapshot: ListSnapshot): Record<string, SessionActivity> {
  const byId: Record<string, SessionActivity> = {}
  for (const [id, row] of Object.entries(snapshot.byId)) {
    // Subagent activity is internal orchestration, not the human's conversation.
    if (row.origin === 'subagent') continue
    byId[id] = {
      running: row.running,
      displayTitle: row.displayTitle,
      ...(row.pendingInteraction === undefined ? {} : { pendingInteraction: row.pendingInteraction }),
    }
  }
  return byId
}

/**
 * Client plugin body: subscribe to the list snapshot, register the card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notifications: dictionaries')
  const t = ctx.locale.bind(NS)
  const settings = { enabled: readStoredEnabled() ?? true }

  const titleOf = (trigger: NotificationTrigger): string =>
    trigger.kind === 'turn-end' ? t('turnEnd.title') : t(pendingLabelKey(trigger.pending))

  const policy = (): NotifyPolicy => ({
    enabled: settings.enabled,
    documentHidden: document.hidden,
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  })

  const show = (trigger: NotificationTrigger): void => {
    if (typeof Notification === 'undefined') return
    const notification = new Notification(titleOf(trigger), { body: trigger.title })
    // Clicking the popup must bring the user back to the conversation: focus
    // the window and open the session the notification is about. The click
    // event is the only user-gesture window the Web Notifications API offers.
    notification.onclick = () => {
      notification.close()
      window.focus()
      ctx.sessions.open(trigger.sessionId as SessionId)
    }
  }

  ctx.effect(() => {
    // Baseline from the CURRENT snapshot: the first live transition after mount
    // must notify (a conversation finishing right after the page loads is real
    // news), while a reload still never replays older history — the store's
    // existing rows carry it, and unchanged rows produce no trigger.
    let prev: ReadonlyMap<string, SessionActivity> =
      new Map(Object.entries(projectActivities(ctx.sessions.list.getSnapshot() as ListSnapshot)))
    return ctx.sessions.list.subscribe(() => {
      const byId = projectActivities(ctx.sessions.list.getSnapshot() as ListSnapshot)
      const { triggers, next } = diffActivities(prev, byId)
      prev = next
      for (const trigger of triggers) {
        if (shouldNotify(policy())) show(trigger)
      }
    })
  }, 'ui-notifications: session activity')

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'ui-notifications',
    order: 30,
    locale: NS,
    inject: (): NotificationsRowInjected => ({
      enabled: () => settings.enabled,
      setEnabled: (value: boolean) => { settings.enabled = value; writeStoredEnabled(value) },
      permission: () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
      requestPermission: async () => {
        if (typeof Notification === 'undefined') return 'unsupported'
        return await Notification.requestPermission()
      },
    }),
  }, NotificationsRow))
}
