// @vitest-environment jsdom
/**
 * ui-notifications browser half on a real cordis Context with fake slots /
 * sessions-list faces: the plugin registers the settings card, watches the
 * list snapshot for live transitions, and pops a Notification only while the
 * page is hidden and the user enabled notifications. Registration disposal
 * rides the plugin fiber (HMR safety). The node half and the invariant
 * companion are exercised over the same Context.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import type { NotificationsRowInjected } from '../src/client/settings-row.tsx'
import { apply as nodeApply } from '../src/index.ts'

// The product copy is Chinese; assert it against a zh-CN browser instead of
// inheriting the runner's en-US.
usePinnedBrowserLanguages('zh-CN')

/** Browser Notification stub: records constructed popups; permission is scriptable. */
class FakeNotification {
  static permission: NotificationPermission = 'granted'
  static instances: FakeNotification[] = []
  static requestPermission(): Promise<NotificationPermission> {
    FakeNotification.permission = 'granted'
    return Promise.resolve('granted')
  }
  readonly title: string
  readonly body: string | undefined
  onclick: (() => void) | null = null
  closed = false
  constructor(title: string, options?: { body?: string }) {
    this.title = title
    this.body = options?.body
    FakeNotification.instances.push(this)
  }
  close() {
    this.closed = true
  }
}

/** The recorded popups as plain records, for deep equality with expectations. */
function recorded(): { title: string; body: string | undefined }[] {
  return FakeNotification.instances.map(instance => ({ title: instance.title, body: instance.body }))
}

/** One session-list row the plugin reads (a projection of SessionSummary). */
interface Row {
  running: boolean
  displayTitle: string
  pendingInteraction?: 'approval' | 'plan-review' | 'question'
  origin?: 'subagent'
}

/** Minimal sessions service double: a synchronous snapshot store over byId. */
function fakeSessions(initial: Record<string, Row> = {}) {
  let byId = initial
  const listeners = new Set<() => void>()
  return {
    list: {
      getSnapshot: () => ({ byId }),
      subscribe: (fn: () => void) => {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
    },
    set(next: Record<string, Row>) {
      byId = next
      for (const fn of [...listeners]) fn()
    },
    open: vi.fn(),
  }
}

async function bench(initial: Record<string, Row> = {}) {
  FakeNotification.permission = 'granted'
  FakeNotification.instances = []
  vi.stubGlobal('Notification', FakeNotification)
  const ctx = new Context()
  const sessions = fakeSessions(initial)
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: { 'settings.general.item': { kind: 'list', scope: 'root' } },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('sessions', sessions)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const entry = ctx.slots.entries('settings.general.item')[0]
  // The slot ledger stores the inject FACTORY; call it to materialize the face.
  const face = (entry?.inject as unknown as (() => NotificationsRowInjected) | undefined)?.()
  return {
    ctx,
    fiber,
    sessions,
    face,
  }
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('ui-notifications browser plugin', () => {
  it('registers the settings card and notifies a finished turn while hidden', async () => {
    setDocumentHidden(true)
    const b = await bench({ s1: { running: true, displayTitle: '任务一' } })
    expect(b.face).toBeTypeOf('object')

    b.sessions.set({ s1: { running: false, displayTitle: '任务一' } })
    expect(recorded()).toEqual([
      { title: '对话结束', body: '任务一' },
    ])
  })

  it('opens the session and focuses the window when the notification is clicked', async () => {
    setDocumentHidden(true)
    // jsdom does not implement focus(); stub it to observe the call cleanly.
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const b = await bench({ s1: { running: true, displayTitle: 's1' } })
    b.sessions.set({ s1: { running: false, displayTitle: 's1' } })
    const notification = FakeNotification.instances[0]
    expect(notification).toBeDefined()
    notification?.onclick?.()
    expect(focus).toHaveBeenCalled()
    expect(b.sessions.open).toHaveBeenCalledWith('s1')
    expect(notification?.closed).toBe(true)
  })

  it('does not notify while the page is visible', async () => {
    setDocumentHidden(false)
    const b = await bench({ s1: { running: true, displayTitle: 's1' } })
    b.sessions.set({ s1: { running: false, displayTitle: 's1' } })
    expect(recorded()).toEqual([])
  })

  it('respects the enable toggle', async () => {
    setDocumentHidden(true)
    const b = await bench({ s1: { running: true, displayTitle: 's1' } })
    b.face?.setEnabled(false)
    expect(b.face?.enabled()).toBe(false)

    b.sessions.set({ s1: { running: false, displayTitle: 's1' } })
    expect(recorded()).toEqual([])
  })

  it.each([
    ['approval', '需要授权'],
    ['question', '需要回答'],
    ['plan-review', '需要审核计划'],
  ] as const)('notifies a %s wait with its label', async (kind, title) => {
    setDocumentHidden(true)
    const b = await bench({ s1: { running: false, displayTitle: 's1' } })
    b.sessions.set({ s1: { running: false, displayTitle: 's1', pendingInteraction: kind } })
    expect(recorded()).toEqual([{ title, body: 's1' }])
  })

  it('ignores subagent activity', async () => {
    setDocumentHidden(true)
    const b = await bench({
      s1: { running: true, displayTitle: 'child', origin: 'subagent' },
    })
    b.sessions.set({ s1: { running: false, displayTitle: 'child', origin: 'subagent' } })
    expect(recorded()).toEqual([])
  })

  it('silently skips without a Notification API', async () => {
    setDocumentHidden(true)
    const b = await bench({ s1: { running: true, displayTitle: 's1' } })
    vi.stubGlobal('Notification', undefined)
    b.sessions.set({ s1: { running: false, displayTitle: 's1' } })
    expect(recorded()).toEqual([])
    expect(b.face?.permission()).toBe('unsupported')
    expect(await b.face?.requestPermission()).toBe('unsupported')
  })

  it('persists the toggle through localStorage', async () => {
    localStorage.setItem('dsh.ui-notifications.enabled', 'false')
    const b = await bench()
    expect(b.face?.enabled()).toBe(false)
    b.face?.setEnabled(true)
    expect(localStorage.getItem('dsh.ui-notifications.enabled')).toBe('true')
  })

  it('defaults to enabled when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('unavailable') },
      setItem: () => { throw new Error('unavailable') },
    })
    const b = await bench()
    expect(b.face?.enabled()).toBe(true)
    expect(() => b.face?.setEnabled(false)).not.toThrow()
  })

  it('drops the row and the subscription when the fiber unloads (HMR safety)', async () => {
    setDocumentHidden(true)
    const b = await bench({ s1: { running: true, displayTitle: 's1' } })
    expect(b.ctx.slots.entries('settings.general.item')).toHaveLength(1)
    await b.fiber.dispose()
    expect(b.ctx.slots.entries('settings.general.item')).toHaveLength(0)

    b.sessions.set({ s1: { running: false, displayTitle: 's1' } })
    expect(recorded()).toEqual([])
  })
})

describe('ui-notifications node half', () => {
  it('the node apply is an inert loader seat', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
