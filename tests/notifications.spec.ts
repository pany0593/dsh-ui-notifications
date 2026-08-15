// Pure transition-detection and fire-gate logic for the notification plugin —
// no DOM, no services.
import { describe, expect, it } from 'vitest'
import { diffActivities, shouldNotify, type SessionActivity } from '../src/client/notifications.ts'

function activity(overrides: Partial<SessionActivity> = {}): SessionActivity {
  return { running: false, displayTitle: 's1', ...overrides }
}

describe('diffActivities', () => {
  it('treats the first snapshot as a baseline and never triggers', () => {
    const { triggers, next } = diffActivities(undefined, { s1: activity({ running: true }) })
    expect(triggers).toEqual([])
    expect(next.get('s1')?.running).toBe(true)
  })

  it('triggers turn-end only on a running true→false transition', () => {
    const prev = new Map([['s1', activity({ running: true })]])
    const { triggers } = diffActivities(prev, { s1: activity({ running: false }) })
    expect(triggers).toEqual([{ kind: 'turn-end', sessionId: 's1', title: 's1' }])
  })

  it('does not trigger when the agent starts or stays idle', () => {
    const idle = new Map([['s1', activity({ running: false })]])
    expect(diffActivities(idle, { s1: activity({ running: true }) }).triggers).toEqual([])
    expect(diffActivities(idle, { s1: activity({ running: false }) }).triggers).toEqual([])
  })

  it('triggers pending only when a wait appears, not while it persists or clears', () => {
    const idle = new Map([['s1', activity({ running: false })]])
    const { triggers } = diffActivities(idle, { s1: activity({ pendingInteraction: 'approval' }) })
    expect(triggers).toEqual([
      { kind: 'pending', sessionId: 's1', title: 's1', pending: 'approval' },
    ])

    const waiting = new Map([['s1', activity({ pendingInteraction: 'approval' })]])
    expect(diffActivities(waiting, { s1: activity({ pendingInteraction: 'approval' }) }).triggers).toEqual([])
    expect(diffActivities(waiting, { s1: activity({}) }).triggers).toEqual([])
  })

  it('ignores sessions absent from the previous snapshot', () => {
    const prev = new Map([['s1', activity({ running: false })]])
    const { triggers } = diffActivities(prev, {
      s1: activity({ running: false }),
      s2: activity({ running: true }),
    })
    expect(triggers).toEqual([])
  })

  it('returns the next snapshot keyed for the caller', () => {
    const prev = new Map([['s1', activity({ running: true })]])
    const { next } = diffActivities(prev, { s1: activity({ running: false }) })
    expect([...next.keys()]).toEqual(['s1'])
    expect(next.get('s1')?.running).toBe(false)
  })
})

describe('shouldNotify', () => {
  it('fires only when enabled, the page is hidden, and permission is granted', () => {
    expect(shouldNotify({ enabled: true, documentHidden: true, permission: 'granted' })).toBe(true)
    expect(shouldNotify({ enabled: false, documentHidden: true, permission: 'granted' })).toBe(false)
    expect(shouldNotify({ enabled: true, documentHidden: false, permission: 'granted' })).toBe(false)
    expect(shouldNotify({ enabled: true, documentHidden: true, permission: 'default' })).toBe(false)
    expect(shouldNotify({ enabled: true, documentHidden: true, permission: 'denied' })).toBe(false)
    expect(shouldNotify({ enabled: true, documentHidden: true, permission: 'unsupported' })).toBe(false)
  })
})
