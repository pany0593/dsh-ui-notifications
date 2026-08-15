/**
 * The system-notification preference row inside General settings (the
 * `settings.general.item` seat): title + description on the left, the enable
 * toggle pill and the browser-permission action on the right. The inject face
 * is shared with the apply-time subscription, and the permission pill is the
 * user-gesture entry point browsers require.
 */
import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-settings SlotMap merge ('settings.general.item').
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NS } from './locales.ts'
import css from './settings-row.module.css'

/** Injectable face: the shared settings object plus the browser permission verbs. */
export interface NotificationsRowInjected {
  /** Whether background notifications are currently enabled. */
  enabled(): boolean
  /** Persist the enable toggle. */
  setEnabled(value: boolean): void
  /** Current browser permission, or 'unsupported' without a Notification API. */
  permission(): NotificationPermission | 'unsupported'
  /** Ask the browser for permission (the user-gesture entry point). */
  requestPermission(): Promise<NotificationPermission | 'unsupported'>
}

/** Props the renderer binds for the notification row. */
export type NotificationsRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<typeof NS>
  & InjectFace<NotificationsRowInjected>

/** Render the system-notification row: the enable toggle and the permission state. */
export function NotificationsRow(
  { t, enabled, setEnabled, permission, requestPermission }: NotificationsRowProps,
) {
  const [isEnabled, setIsEnabled] = useState(enabled())
  const [perm, setPerm] = useState(permission())
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
      </div>
      <div className={css.controls}>
        <button
          type="button"
          className={css.selector}
          aria-pressed={isEnabled}
          onClick={() => {
            const next = !isEnabled
            setIsEnabled(next)
            setEnabled(next)
          }}
        >
          {t(isEnabled ? 'enable.on' : 'enable.off')}
        </button>
        {perm === 'default' && (
          <button
            type="button"
            className={css.selector}
            onClick={async () => { setPerm(await requestPermission()) }}
          >
            {t('permission.request')}
          </button>
        )}
        {perm === 'denied' && (
          <button type="button" className={css.selector} disabled>{t('permission.denied')}</button>
        )}
        {perm === 'unsupported' && (
          <button type="button" className={css.selector} disabled>{t('permission.unsupported')}</button>
        )}
      </div>
    </div>
  )
}
