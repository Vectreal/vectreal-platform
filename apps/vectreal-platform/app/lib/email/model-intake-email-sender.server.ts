import { render } from '@react-email/render'
import { createElement, type ReactElement } from 'react'

import {
	getResendClient,
	resolveContactInboxEmail,
	resolveFromEmail
} from './resend.server'
import { ModelIntakeConfirmationEmail } from './templates/model-intake-confirmation'
import {
	ModelIntakeInternalEmail,
	type ModelIntakeInternalEmailProps
} from './templates/model-intake-internal'
import { MODEL_INTAKE_COPY } from '../../constants/product-copy'

import type { ModelIntakeLocale } from '../domain/model-intake/model-intake-shared'

export type EmailSendResult = { ok: boolean; error?: string }

async function send(args: {
	to: string
	subject: string
	replyTo?: string
	element: ReactElement
}): Promise<EmailSendResult> {
	// Matches the contact sender: without a key, dev skips and production fails.
	if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') {
		console.warn(
			`[model-intake] RESEND_API_KEY not set - skipping "${args.subject}" in dev`
		)
		return { ok: true }
	}

	try {
		const [html, text] = await Promise.all([
			render(args.element),
			render(args.element, { plainText: true })
		])
		const { error } = await getResendClient().emails.send({
			from: resolveFromEmail(),
			to: [args.to],
			replyTo: args.replyTo,
			subject: args.subject,
			html,
			text
		})
		return error ? { ok: false, error: error.message } : { ok: true }
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

export function sendIntakeInternalNotification(
	props: ModelIntakeInternalEmailProps
): Promise<EmailSendResult> {
	return send({
		to: resolveContactInboxEmail(),
		replyTo: `${props.name} <${props.email}>`,
		subject: `[Free model] ${props.productType} from ${props.company} (${props.referenceCode})`,
		element: createElement(ModelIntakeInternalEmail, props)
	})
}

export function sendIntakeConfirmation(args: {
	locale: ModelIntakeLocale
	email: string
	displayName: string
	referenceCode: string
}): Promise<EmailSendResult> {
	return send({
		to: args.email,
		subject: MODEL_INTAKE_COPY[args.locale].confirmationEmail.subject(
			args.referenceCode
		),
		element: createElement(ModelIntakeConfirmationEmail, {
			locale: args.locale,
			displayName: args.displayName,
			referenceCode: args.referenceCode
		})
	})
}
