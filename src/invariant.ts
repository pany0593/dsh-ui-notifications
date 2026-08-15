/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-notifications`.
 * @module @deepseek-ai/dsh-client-ui-notifications/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-notifications'

/** Cordis companion plugin name. */
export const name = 'client-ui-notifications-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the browser half derives notifications purely from the
 * sessions list snapshot (a framework-owned projection) and owns no durable
 * event stream or mutable domain data; client specs cover the transitions.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
