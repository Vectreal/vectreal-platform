import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Textarea } from '@shared/components/ui/textarea'
import { Form } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import {
	CONTACT_HONEYPOT_FIELD,
	type ContactActionData,
	type ContactInquiryType
} from '../../lib/domain/contact/contact-shared'
import { TurnstileWidget } from '../turnstile-widget'

interface ContactFormProps {
	source: string
	isAuthenticated: boolean
	inquiryType: ContactInquiryType
	onInquiryTypeChange: (type: ContactInquiryType) => void
	turnstileSiteKey: string
	turnstileToken: string | null
	onTurnstileSuccess: (token: string) => void
	onTurnstileError: () => void
	turnstileResetNonce: number
	isSubmitting: boolean
	actionData?: ContactActionData
	onSubmit: () => void
}

export function ContactForm({
	source,
	inquiryType,
	onInquiryTypeChange,
	turnstileSiteKey,
	turnstileToken,
	onTurnstileSuccess,
	onTurnstileError,
	turnstileResetNonce,
	isSubmitting,
	actionData,
	onSubmit
}: ContactFormProps) {
	const HONEYPOT_FIELD = CONTACT_HONEYPOT_FIELD

	return (
		<Form method="post" className="space-y-5" onSubmit={onSubmit}>
			<AuthenticityTokenInput />
			<input type="hidden" name="source" value={source} />
			<input
				type="hidden"
				name="cf-turnstile-response"
				value={turnstileToken ?? ''}
			/>
			<input
				type="text"
				name={HONEYPOT_FIELD}
				tabIndex={-1}
				autoComplete="off"
				className="hidden"
				aria-hidden="true"
			/>

			<div className="grid gap-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="name">Full name</Label>
					<Input
						id="name"
						name="name"
						required
						autoComplete="name"
						defaultValue={actionData?.fields?.name ?? ''}
						placeholder="Jane Doe"
					/>
					{actionData?.fieldErrors?.name ? (
						<p className="text-destructive text-sm">
							{actionData.fieldErrors.name}
						</p>
					) : null}
				</div>

				<div className="space-y-2">
					<Label htmlFor="email">Work email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						required
						autoComplete="email"
						defaultValue={actionData?.fields?.email ?? ''}
						placeholder="you@company.com"
					/>
					{actionData?.fieldErrors?.email ? (
						<p className="text-destructive text-sm">
							{actionData.fieldErrors.email}
						</p>
					) : null}
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="inquiryType">Inquiry type</Label>
				<Select value={inquiryType} onValueChange={onInquiryTypeChange}>
					<SelectTrigger id="inquiryType" className="w-full">
						<SelectValue placeholder="Select inquiry type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="support">Product support</SelectItem>
						<SelectItem value="sales">Sales and plans</SelectItem>
						<SelectItem value="partnership">Partnership</SelectItem>
						<SelectItem value="other">Other</SelectItem>
					</SelectContent>
				</Select>
				<input type="hidden" name="inquiryType" value={inquiryType} />
				{actionData?.fieldErrors?.inquiryType ? (
					<p className="text-destructive text-sm">
						{actionData.fieldErrors.inquiryType}
					</p>
				) : null}
			</div>

			<div className="space-y-2">
				<Label htmlFor="message">Message</Label>
				<Textarea
					id="message"
					name="message"
					required
					rows={7}
					defaultValue={actionData?.fields?.message ?? ''}
					placeholder="Tell us about your use case, current blockers, and timeline."
				/>
				{actionData?.fieldErrors?.message ? (
					<p className="text-destructive text-sm">
						{actionData.fieldErrors.message}
					</p>
				) : (
					<p className="text-muted-foreground text-xs">
						No sensitive credentials or private keys, please.
					</p>
				)}
			</div>

			<TurnstileWidget
				siteKey={turnstileSiteKey}
				onSuccess={onTurnstileSuccess}
				resetNonce={turnstileResetNonce}
				onError={onTurnstileError}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="submit"
					size="lg"
					disabled={
						isSubmitting ||
						(Boolean(turnstileSiteKey) && turnstileToken === null)
					}
				>
					{isSubmitting ? 'Sending...' : 'Send message'}
				</Button>
				<p className="text-muted-foreground text-sm">
					Prefer direct email?{' '}
					<a href="mailto:info@vectreal.com" className="underline">
						info@vectreal.com
					</a>
				</p>
			</div>
		</Form>
	)
}
