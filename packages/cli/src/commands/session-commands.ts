import { createVectrealClient, type Me } from '@vctrl/sdk'

import {
	type CliContext,
	type GlobalOptions,
	report,
	signedInClient,
	targetOrigin
} from '../context'
import {
	loadSession,
	readConfig,
	saveSession,
	writeConfig
} from '../credentials'
import { NotSignedInError } from '../errors'
import { signIn } from '../oauth'

function describeMe(origin: string, me: Me): string {
	return [
		`Signed in to ${origin} as ${me.user.email ?? me.user.id}`,
		`Organization: ${me.organization.name} (${me.organization.role})`,
		`Scopes: ${me.scopes.join(', ') || 'none'}`
	].join('\n')
}

export async function login(
	context: CliContext,
	options: GlobalOptions & { browser: boolean }
): Promise<number> {
	const origin = targetOrigin(context, options)
	const client = await createVectrealClient({
		baseUrl: origin,
		fetch: context.fetch
	}).cliClient()

	const tokens = await signIn({
		client,
		origin,
		fetch: context.fetch,
		presentUrl: (url) => {
			context.err(`Open this page to sign in:\n  ${url}`)
			if (options.browser) context.openBrowser(url)
		}
	})
	saveSession(context.store, origin, {
		clientId: client.client_id,
		authorizationServer: client.authorization_server,
		...tokens
	})
	writeConfig(context.configDir, {
		...readConfig(context.configDir),
		defaultOrigin: origin
	})

	const me = await signedInClient(context, origin).me()
	report(context, options, { origin, ...me }, describeMe(origin, me))
	return 0
}

export async function whoami(
	context: CliContext,
	options: GlobalOptions
): Promise<number> {
	const origin = targetOrigin(context, options)
	const me = await signedInClient(context, origin).me()
	report(context, options, { origin, ...me }, describeMe(origin, me))
	return 0
}

/**
 * Ends the session on the server, then forgets it here. The local session is
 * deleted whatever the server says; when the server could not end it, the
 * user is told where to revoke the CLI instead.
 */
export async function logout(
	context: CliContext,
	options: GlobalOptions
): Promise<number> {
	const origin = targetOrigin(context, options)
	if (!loadSession(context.store, origin)) {
		report(
			context,
			options,
			{ origin, signedOut: false },
			`Not signed in to ${origin}.`
		)
		return 0
	}

	let endedOnServer: boolean
	try {
		await signedInClient(context, origin).endSession()
		endedOnServer = true
	} catch (error) {
		// A refused refresh means Auth no longer holds the session. An API
		// refusal does not: `invalid_token` also answers a live session whose
		// grant is gone, which the route never reaches to end.
		endedOnServer = error instanceof NotSignedInError
	}
	context.store.delete(origin)

	if (!endedOnServer) {
		context.err(
			`The server did not confirm the sign-out, so the session may still work until it expires. To end it now, revoke the Vectreal CLI at ${origin}/dashboard/connected-agents.`
		)
	}
	report(
		context,
		options,
		{ origin, signedOut: true, endedOnServer },
		`Signed out of ${origin}.`
	)
	return 0
}
