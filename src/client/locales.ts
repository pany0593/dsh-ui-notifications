/** `ui.notifications` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'ui.notifications'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '系统通知',
  'description': '对话结束或需要你响应时，页面不在前台也能收到系统级弹窗提醒。',
  'enable.on': '已开启',
  'enable.off': '已关闭',
  'permission.request': '开启系统通知',
  'permission.denied': '权限被拒绝',
  'permission.unsupported': '浏览器不支持',
  'turnEnd.title': '对话结束',
  'pending.approval': '需要授权',
  'pending.question': '需要回答',
  'pending.plan-review': '需要审核计划',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<NotificationsKey, string> = {
  'title': 'System notifications',
  'description': 'When a conversation finishes or your response is needed, pop up an OS-level notification even while the page is in the background.',
  'enable.on': 'On',
  'enable.off': 'Off',
  'permission.request': 'Enable notifications',
  'permission.denied': 'Permission blocked',
  'permission.unsupported': 'Not supported',
  'turnEnd.title': 'Conversation finished',
  'pending.approval': 'Approval needed',
  'pending.question': 'Answer needed',
  'pending.plan-review': 'Plan review needed',
}

/** Key domain of the `ui.notifications` namespace (zh is the source of truth). */
export type NotificationsKey = keyof typeof zh
