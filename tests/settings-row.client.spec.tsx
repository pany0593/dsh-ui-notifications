// @vitest-environment jsdom
// The General-settings row: the enable toggle pill and the browser permission
// states, with the request pill as the user-gesture path.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { NotificationsRow, type NotificationsRowInjected, type NotificationsRowProps } from '../src/client/settings-row.tsx'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)

function renderRow(overrides: Partial<NotificationsRowInjected> = {}) {
  const face: NotificationsRowInjected = {
    enabled: () => true,
    setEnabled: vi.fn(),
    permission: () => 'default',
    requestPermission: async () => 'granted',
    ...overrides,
  }
  // The renderer binds the PropsRuntime seats; the row only reads the inject
  // face and t, so a plain stub cast keeps the spec free of render machinery.
  const props = {
    t,
    useSessions: () => undefined,
    ...face,
  } as unknown as NotificationsRowProps
  const view = render(<NotificationsRow {...props} />)
  return { ...view, face }
}

describe('NotificationsRow', () => {
  it('renders the title, description, and an enabled toggle pill by default', () => {
    const { getByText } = renderRow()
    expect(getByText('系统通知')).toBeTruthy()
    expect(getByText('已开启')).toBeTruthy()
    expect(getByText('开启系统通知')).toBeTruthy()
  })

  it('toggles the shared enable flag from the pill', () => {
    const setEnabled = vi.fn()
    const { getByText } = renderRow({ setEnabled })
    fireEvent.click(getByText('已开启'))
    expect(getByText('已关闭')).toBeTruthy()
    expect(setEnabled).toHaveBeenCalledWith(false)
  })

  it('reflects a persisted off state', () => {
    const { getByText } = renderRow({ enabled: () => false })
    expect(getByText('已关闭')).toBeTruthy()
  })

  it('hides the permission pill once granted', () => {
    const { queryByText } = renderRow({ permission: () => 'granted' })
    expect(queryByText('开启系统通知')).toBeNull()
  })

  it('shows disabled pills for denied and unsupported states', () => {
    const denied = renderRow({ permission: () => 'denied' })
    expect((denied.getByText('权限被拒绝') as HTMLButtonElement).disabled).toBe(true)

    const unsupported = renderRow({ permission: () => 'unsupported' })
    expect((unsupported.getByText('浏览器不支持') as HTMLButtonElement).disabled).toBe(true)
  })

  it('requests permission from the pill and reports the result', async () => {
    const requestPermission = vi.fn(async () => 'granted' as const)
    const { getByText, queryByText } = renderRow({ requestPermission })
    fireEvent.click(getByText('开启系统通知'))
    expect(requestPermission).toHaveBeenCalledOnce()
    // After granting, the request pill disappears.
    await waitFor(() => expect(queryByText('开启系统通知')).toBeNull())
  })

  it('reports an unsupported request result', async () => {
    const requestPermission = vi.fn(async () => 'unsupported' as const)
    const { getByText, findByText } = renderRow({ requestPermission })
    fireEvent.click(getByText('开启系统通知'))
    expect(await findByText('浏览器不支持')).toBeTruthy()
  })
})

afterEach(cleanup)
