declare const Deno: {
	env: {
		get(name: string): string | undefined
	}
	serve(handler: (request: Request) => Response | Promise<Response>): void
}

// @ts-expect-error URL imports are resolved at runtime in Supabase Edge Functions.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

interface AuthHookUser {
	id: string
	email?: string
	user_metadata?: {
		username?: string
	}
}

interface AuthHookEmailData {
	email_action_type:
		| 'signup'
		| 'recovery'
		| 'email'
		| 'magic_link'
		| 'magiclink'
		| 'email_change_new'
		| 'email_change_current'
		| 'invite'
		| 'reauthentication'
		| 'password_changed_notification'
	token: string
	token_hash: string
	token_new?: string
	token_hash_new?: string
	redirect_to?: string
	site_url: string
}

interface AuthHookPayload {
	user: AuthHookUser
	email_data: AuthHookEmailData
}

type SupportedEmailAction = AuthHookEmailData['email_action_type']

interface ComposedEmail {
	subject: string
	html: string
}

type CanonicalEmailAction =
	| 'signup'
	| 'recovery'
	| 'magic_link'
	| 'email_change_new'
	| 'email_change_current'
	| 'invite'
	| 'reauthentication'
	| 'password_changed_notification'

type ConfirmLinkAction = Exclude<
	CanonicalEmailAction,
	'reauthentication' | 'password_changed_notification'
>

interface TemplateConfig {
	subject: string
	heading: string
	intro: (name: string) => string
	outro: string
	ctaLabel?: string
}

const API = {
	resendEmailUrl: 'https://api.resend.com/emails',
	confirmPath: '/auth/confirm'
} as const

const ENV = {
	hookSecret: 'SEND_EMAIL_HOOK_SECRET',
	resendApiKey: 'RESEND_API_KEY',
	authFromEmail: 'AUTH_FROM_EMAIL'
} as const

const ERROR_MESSAGE = {
	envMissing: (name: string) => `${name} is required`,
	unsupportedAction: (action: string) =>
		`Unsupported email_action_type: ${action}`,
	resendFailure: (status: number, payload: string) =>
		`Resend request failed (${status}): ${payload}`,
	unknown: 'Unknown error',
	methodNotAllowed: 'Method Not Allowed',
	unauthorized: 'Unauthorized',
	invalidPayload: 'Invalid payload'
} as const

const LOG_MESSAGE = {
	deliveryFailed: '[send-auth-email] Failed to deliver auth email'
} as const

const HTTP_STATUS = {
	ok: 200,
	badRequest: 400,
	unauthorized: 401,
	methodNotAllowed: 405,
	internalServerError: 500
} as const

const COPY = {
	brandName: 'Vectreal',
	fallbackDisplayName: 'there',
	textBodyPrefix: 'Continue your Vectreal action with this link: ',
	passwordChangedText:
		'Your Vectreal password was changed. If this was not you, reset your password immediately and contact support.',
	verificationCodeTextPrefix: 'Your Vectreal verification code is: '
} as const

const EMAIL_STYLE = {
	body: "margin:0;padding:0;background:#050816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e8ecff;",
	outerTable: 'padding:28px 12px;background:#050816;',
	card: 'max-width:560px;border:1px solid #1e2644;border-radius:14px;background:#0d1530;overflow:hidden;',
	headerCell: 'padding:26px 28px;border-bottom:1px solid #1e2644;',
	brand:
		'margin:0;font-size:20px;font-weight:700;letter-spacing:0.02em;color:#ffffff;',
	contentCell: 'padding:28px;',
	heading: 'margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;',
	intro: 'margin:0 0 20px;color:#ccd6f6;font-size:15px;line-height:1.7;',
	cta: 'display:inline-block;padding:12px 20px;background:#0f62fe;border-radius:8px;color:#ffffff;text-decoration:none;font-weight:600;',
	code: 'margin:16px 0 0;font-size:24px;letter-spacing:3px;font-weight:700;color:#f5f7ff;',
	outro: 'margin:20px 0 0;color:#9aa6c5;font-size:14px;line-height:1.6;'
} as const

const ACTION_ALIAS_TO_CANONICAL: Record<
	SupportedEmailAction,
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

const CONFIRM_TYPE_BY_ACTION: Record<ConfirmLinkAction, string> = {
	signup: 'signup',
	recovery: 'recovery',
	magic_link: 'email',
	email_change_new: 'email_change',
	email_change_current: 'email_change',
	invite: 'invite'
}

const TEMPLATE_BY_ACTION: Record<CanonicalEmailAction, TemplateConfig> = {
	magic_link: {
		subject: 'Sign in to Vectreal',
		heading: 'Use your secure sign-in link',
		intro: (name) =>
			`Hi ${name}, click below to sign in to your Vectreal account.`,
		ctaLabel: 'Sign in',
		outro: 'If you did not request this email, you can safely ignore it.'
	},
	signup: {
		subject: 'Confirm your Vectreal account',
		heading: 'Welcome to Vectreal',
		intro: (name) =>
			`Hi ${name}, confirm your email to finish creating your account.`,
		ctaLabel: 'Confirm email',
		outro: 'This link expires automatically for your security.'
	},
	recovery: {
		subject: 'Reset your Vectreal password',
		heading: 'Password reset requested',
		intro: (name) =>
			`Hi ${name}, use this link to set a new password for your Vectreal account.`,
		ctaLabel: 'Reset password',
		outro:
			'If you did not request this change, ignore this email and your password will stay the same.'
	},
	email_change_new: {
		subject: 'Confirm your new Vectreal email',
		heading: 'Confirm your new email address',
		intro: () =>
			'We received a request to update the email on your Vectreal account. Confirm the new address below.',
		ctaLabel: 'Confirm new email',
		outro: 'If this was not you, please secure your account immediately.'
	},
	email_change_current: {
		subject: 'Approve your Vectreal email change',
		heading: 'Approve this email change',
		intro: () =>
			'Before we switch your account to a new email address, please approve the request from your current address.',
		ctaLabel: 'Approve change',
		outro:
			'If you did not make this request, ignore this email and keep your account secure.'
	},
	invite: {
		subject: 'You were invited to Vectreal',
		heading: 'You have been invited',
		intro: () =>
			'Join your team on Vectreal to manage and publish 3D experiences together.',
		ctaLabel: 'Accept invite',
		outro: 'If this invitation was unexpected, you can ignore this email.'
	},
	reauthentication: {
		subject: 'Your Vectreal verification code',
		heading: 'Verification required',
		intro: () =>
			'Use this verification code to continue your secure action in Vectreal.',
		outro: 'This code expires shortly for your security.'
	},
	password_changed_notification: {
		subject: 'Your Vectreal password was changed',
		heading: 'Password changed successfully',
		intro: () =>
			'Your Vectreal account password was just changed. If this was you, no further action is needed.',
		outro:
			'If you did not make this change, reset your password immediately and contact support.'
	}
}

function readRequiredEnv(name: string): string {
	const value = Deno.env.get(name)
	if (!value) {
		throw new Error(ERROR_MESSAGE.envMissing(name))
	}

	return value
}

function normalizeHookSecret(secret: string): string {
	return secret.replace('v1,whsec_', '').replace('whsec_', '')
}

function verifyHookRequest(args: {
	payload: string
	headers: Headers
	hookSecret: string
}): AuthHookPayload {
	const verifier = new Webhook(normalizeHookSecret(args.hookSecret))
	const headerMap = Object.fromEntries(args.headers)

	return verifier.verify(args.payload, headerMap) as AuthHookPayload
}

function escapeHtml(input: string): string {
	return input
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')
}

function getDisplayName(payload: AuthHookPayload): string {
	const username = payload.user.user_metadata?.username?.trim()
	if (username) {
		return username
	}

	return COPY.fallbackDisplayName
}

function canonicalizeAction(
	action: SupportedEmailAction
): CanonicalEmailAction {
	return ACTION_ALIAS_TO_CANONICAL[action]
}

function needsConfirmLink(
	action: CanonicalEmailAction
): action is ConfirmLinkAction {
	return (
		action !== 'reauthentication' && action !== 'password_changed_notification'
	)
}

function resolveTokenHash(
	payload: AuthHookPayload,
	action: ConfirmLinkAction
): string {
	if (action === 'email_change_new') {
		return payload.email_data.token_hash_new ?? payload.email_data.token_hash
	}

	return payload.email_data.token_hash
}

function resolveNextPath(redirectTo: string | undefined): string | null {
	if (!redirectTo) {
		return null
	}

	try {
		const parsed = new URL(redirectTo)
		if (parsed.pathname.startsWith('/')) {
			const nextPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
			return nextPath === '/' ? null : nextPath
		}
	} catch {
		if (redirectTo.startsWith('/')) {
			return redirectTo
		}
	}

	return null
}

function buildConfirmLink(args: {
	siteUrl: string
	tokenHash: string
	type: string
	redirectTo?: string
}): string {
	const url = new URL(API.confirmPath, args.siteUrl)
	url.searchParams.set('token_hash', args.tokenHash)
	url.searchParams.set('type', args.type)

	const nextPath = resolveNextPath(args.redirectTo)
	if (nextPath) {
		url.searchParams.set('next', nextPath)
	}

	return url.toString()
}

function renderLayout(args: {
	heading: string
	intro: string
	ctaLabel?: string
	ctaHref?: string
	outro?: string
	code?: string
}): string {
	const buttonMarkup =
		args.ctaHref && args.ctaLabel
			? `<a href="${escapeHtml(args.ctaHref)}" style="${EMAIL_STYLE.cta}">${escapeHtml(args.ctaLabel)}</a>`
			: ''

	const codeMarkup = args.code
		? `<p style="${EMAIL_STYLE.code}">${escapeHtml(args.code)}</p>`
		: ''

	const outroMarkup = args.outro
		? `<p style="${EMAIL_STYLE.outro}">${escapeHtml(args.outro)}</p>`
		: ''

	return `<!doctype html>
<html>
  <body style="${EMAIL_STYLE.body}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${EMAIL_STYLE.outerTable}">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${EMAIL_STYLE.card}">
            <tr>
              <td style="${EMAIL_STYLE.headerCell}">
                <p style="${EMAIL_STYLE.brand}">${COPY.brandName}</p>
              </td>
            </tr>
            <tr>
              <td style="${EMAIL_STYLE.contentCell}">
                <h1 style="${EMAIL_STYLE.heading}">${escapeHtml(args.heading)}</h1>
                <p style="${EMAIL_STYLE.intro}">${escapeHtml(args.intro)}</p>
                ${buttonMarkup}
                ${codeMarkup}
                ${outroMarkup}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function composeEmail(payload: AuthHookPayload): ComposedEmail {
	const action = canonicalizeAction(payload.email_data.email_action_type)
	const name = getDisplayName(payload)

	const template = TEMPLATE_BY_ACTION[action]

	if (needsConfirmLink(action)) {
		const href = buildConfirmLink({
			siteUrl: payload.email_data.site_url,
			tokenHash: resolveTokenHash(payload, action),
			type: CONFIRM_TYPE_BY_ACTION[action],
			redirectTo: payload.email_data.redirect_to
		})

		return {
			subject: template.subject,
			html: renderLayout({
				heading: template.heading,
				intro: template.intro(name),
				ctaLabel: template.ctaLabel,
				ctaHref: href,
				outro: template.outro
			})
		}
	}

	if (action === 'reauthentication') {
		return {
			subject: template.subject,
			html: renderLayout({
				heading: template.heading,
				intro: template.intro(name),
				code: payload.email_data.token,
				outro: template.outro
			})
		}
	}

	if (action === 'password_changed_notification') {
		return {
			subject: template.subject,
			html: renderLayout({
				heading: template.heading,
				intro: template.intro(name),
				outro: template.outro
			})
		}
	}

	throw new Error(ERROR_MESSAGE.unsupportedAction(action))
}

function toTextBody(
	payload: AuthHookPayload,
	action: SupportedEmailAction
): string {
	const canonicalAction = canonicalizeAction(action)

	if (canonicalAction === 'reauthentication') {
		return `${COPY.verificationCodeTextPrefix}${payload.email_data.token}`
	}

	if (canonicalAction === 'password_changed_notification') {
		return COPY.passwordChangedText
	}

	const link = buildConfirmLink({
		siteUrl: payload.email_data.site_url,
		tokenHash: resolveTokenHash(payload, canonicalAction),
		type: CONFIRM_TYPE_BY_ACTION[canonicalAction],
		redirectTo: payload.email_data.redirect_to
	})

	return `${COPY.textBodyPrefix}${link}`
}

async function sendEmailWithResend(args: {
	resendApiKey: string
	from: string
	to: string
	subject: string
	html: string
	text: string
}): Promise<void> {
	const response = await fetch(API.resendEmailUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${args.resendApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: args.from,
			to: [args.to],
			subject: args.subject,
			html: args.html,
			text: args.text
		})
	})

	if (!response.ok) {
		const payload = await response.text()
		throw new Error(ERROR_MESSAGE.resendFailure(response.status, payload))
	}
}

Deno.serve(async (request) => {
	if (request.method !== 'POST') {
		return Response.json(
			{ error: ERROR_MESSAGE.methodNotAllowed },
			{ status: HTTP_STATUS.methodNotAllowed }
		)
	}

	try {
		const payloadText = await request.text()
		const hookSecret = readRequiredEnv(ENV.hookSecret)

		let payload: AuthHookPayload
		try {
			payload = verifyHookRequest({
				payload: payloadText,
				headers: request.headers,
				hookSecret
			})
		} catch {
			return Response.json(
				{ error: ERROR_MESSAGE.unauthorized },
				{ status: HTTP_STATUS.unauthorized }
			)
		}

		const action = payload.email_data?.email_action_type
		const recipient = payload.user?.email?.trim()

		if (!action || !recipient) {
			return Response.json(
				{ error: ERROR_MESSAGE.invalidPayload },
				{ status: HTTP_STATUS.badRequest }
			)
		}

		const resendApiKey = readRequiredEnv(ENV.resendApiKey)
		const from = readRequiredEnv(ENV.authFromEmail)
		const email = composeEmail(payload)
		const text = toTextBody(payload, action)

		await sendEmailWithResend({
			resendApiKey,
			from,
			to: recipient,
			subject: email.subject,
			html: email.html,
			text
		})

		return Response.json({ ok: true }, { status: HTTP_STATUS.ok })
	} catch {
		console.error(LOG_MESSAGE.deliveryFailed)
		return Response.json(
			{ error: ERROR_MESSAGE.unknown },
			{ status: HTTP_STATUS.internalServerError }
		)
	}
})
