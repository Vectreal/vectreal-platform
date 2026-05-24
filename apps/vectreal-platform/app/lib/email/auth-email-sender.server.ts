import { render } from '@react-email/render'
import { createElement } from 'react'

import { getResendClient, resolveFromEmail } from './resend.server'
import {
	AuthEmail,
	getAuthEmailSubject,
	type CanonicalEmailAction
} from './templates/auth-email'

import type {
	AuthHookPayload,
	RawEmailActionType
} from './auth-hook-verifier.server'

// ---------------------------------------------------------------------------
// Action alias normalization
// ---------------------------------------------------------------------------

const ACTION_ALIAS_TO_CANONICAL: Record<
	RawEmailActionType,
	CanonicalEmailAction
> = {
	signup: 'signup',
	recovery: 'recovery',
	email: 'magic_link',
	magic_link: 'magic_link',
	magiclink: 'magic_link',
	email_change_new: 'email_change_new',
	email_change_current: 'email_change_current',
	invite: 'invite',
	reauthentication: 'reauthentication',
	password_changed_notification: 'password_changed_notification'
}

// Confirm endpoint type param values expected by /auth/confirm
const CONFIRM_TYPE_BY_ACTION: Partial<Record<CanonicalEmailAction, string>> = {
	signup: 'signup',
	recovery: 'recovery',
	magic_link: 'email',
	email_change_new: 'email_change',
	email_change_current: 'email_change',
	invite: 'invite'
}

const AUTH_CONFIRM_PATH = '/auth/confirm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Supabase's hook payload `site_url` reflects the Supabase project's own REST
// base URL, not the application URL. Always prefer APPLICATION_URL so the
// confirmation link points at the app's /auth/confirm route.
function resolveAppBaseUrl(payloadSiteUrl: string): string {
	return process.env.APPLICATION_URL?.trim() || payloadSiteUrl
}

function canonicalizeAction(raw: RawEmailActionType): CanonicalEmailAction {
	const action = ACTION_ALIAS_TO_CANONICAL[raw]
	if (!action) {
		throw new Error(`Unsupported email_action_type: ${raw}`)
	}
	return action
}

function needsConfirmLink(
	action: CanonicalEmailAction
): action is Exclude<
	CanonicalEmailAction,
	'reauthentication' | 'password_changed_notification'
> {
	return (
		action !== 'reauthentication' && action !== 'password_changed_notification'
	)
}

function getDisplayName(payload: AuthHookPayload): string {
	const name = payload.user.user_metadata?.name?.trim()
	if (name) return name
	const username = payload.user.user_metadata?.username?.trim()
	if (username) return username
	return 'there'
}

function resolveNextPath(redirectTo: string | undefined): string | null {
	if (!redirectTo) return null
	try {
		const parsed = new URL(redirectTo)
		if (parsed.pathname.startsWith('/')) {
			const next = `${parsed.pathname}${parsed.search}${parsed.hash}`
			return next === '/' ? null : next
		}
	} catch {
		if (redirectTo.startsWith('/')) return redirectTo
	}
	return null
}

function buildConfirmLink(args: {
	siteUrl: string
	tokenHash: string
	type: string
	redirectTo?: string
}): string {
	const url = new URL(AUTH_CONFIRM_PATH, args.siteUrl)
	url.searchParams.set('token_hash', args.tokenHash)
	url.searchParams.set('type', args.type)
	const next = resolveNextPath(args.redirectTo)
	if (next) url.searchParams.set('next', next)
	return url.toString()
}

function resolveTokenHash(
	payload: AuthHookPayload,
	action: CanonicalEmailAction
): string {
	if (action === 'email_change_new') {
		return payload.email_data.token_hash_new ?? payload.email_data.token_hash
	}
	return payload.email_data.token_hash
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendAuthEmail(payload: AuthHookPayload): Promise<void> {
	const recipient = payload.user.email?.trim()
	if (!recipient) {
		throw new Error('Auth hook payload is missing user.email')
	}

	const action = canonicalizeAction(payload.email_data.email_action_type)
	const displayName = getDisplayName(payload)

	let ctaHref: string | undefined
	if (needsConfirmLink(action)) {
		const confirmType = CONFIRM_TYPE_BY_ACTION[action]
		if (confirmType) {
			ctaHref = buildConfirmLink({
				siteUrl: resolveAppBaseUrl(payload.email_data.site_url),
				tokenHash: resolveTokenHash(payload, action),
				type: confirmType,
				redirectTo: payload.email_data.redirect_to
			})
		}
	}

	const code =
		action === 'reauthentication' ? payload.email_data.token : undefined
	const subject = getAuthEmailSubject(action)

	// Render via React Email - createElement avoids needing JSX in .server.ts
	// plainText: true generates a full text/plain MIME part, fixing spam filter penalties
	const element = createElement(AuthEmail, {
		action,
		displayName,
		ctaHref,
		code
	})
	const [html, text] = await Promise.all([
		render(element),
		render(element, { plainText: true })
	])

	const resend = getResendClient()
	const from = resolveFromEmail()

	const { error } = await resend.emails.send({
		from,
		to: [recipient],
		subject,
		html,
		text
	})

	if (error) {
		throw new Error(`Resend delivery failed: ${error.message}`)
	}
}
