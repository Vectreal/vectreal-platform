import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
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
import { useState } from 'react'
import { Form, Link } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { PhotoSlots } from './photo-slots'
import { MODEL_INTAKE_COPY } from '../../constants/product-copy'
import {
	MODEL_INTAKE_HONEYPOT_FIELD,
	MODEL_INTAKE_MAX_MESSAGE_LENGTH,
	MODEL_INTAKE_PRODUCT_TYPES,
	MODEL_INTAKE_SIZE_FIELDS,
	type ModelIntakeActionData,
	type ModelIntakeBatch,
	type ModelIntakeFieldErrorCode,
	type ModelIntakeLocale
} from '../../lib/domain/model-intake/model-intake-shared'
import { InlineNotice } from '../layout-components'
import { TurnstileWidget } from '../turnstile-widget'

interface ModelIntakeFormProps {
	locale: ModelIntakeLocale
	batch: ModelIntakeBatch
	turnstileSiteKey: string
	turnstileToken: string | null
	onTurnstileSuccess: (token: string) => void
	onTurnstileError: () => void
	turnstileFailed: boolean
	turnstileResetNonce: number
	isSubmitting: boolean
	actionData?: ModelIntakeActionData
}

function FieldError({
	id,
	message
}: {
	id: string
	message: string | undefined
}) {
	return message ? (
		<p id={id} className="text-destructive text-body-sm">
			{message}
		</p>
	) : null
}

export function ModelIntakeForm({
	locale,
	batch,
	turnstileSiteKey,
	turnstileToken,
	onTurnstileSuccess,
	onTurnstileError,
	turnstileFailed,
	turnstileResetNonce,
	isSubmitting,
	actionData
}: ModelIntakeFormProps) {
	const copy = MODEL_INTAKE_COPY[locale]
	const failed = actionData?.status === 'error' ? actionData : undefined
	const errors = failed?.fieldErrors
	const fields = failed?.fields
	const [productType, setProductType] = useState(fields?.productType ?? '')

	const say = (code: ModelIntakeFieldErrorCode | undefined, n?: number) =>
		code ? copy.fieldErrors[code](n) : undefined

	// A photo refused for size on this device outranks the last server answer.
	const [tooLargeIndex, setTooLargeIndex] = useState<number | null>(null)
	const photosError =
		tooLargeIndex !== null
			? say('photoSize', tooLargeIndex)
			: say(errors?.photos, errors?.photoIndex)
	const photosInvalidIndex =
		tooLargeIndex ?? (errors?.photos ? (errors.photoIndex ?? 0) : undefined)

	return (
		<Form
			method="post"
			encType="multipart/form-data"
			className="space-y-6"
			noValidate
		>
			<AuthenticityTokenInput />
			<input type="hidden" name="lang" value={locale} />
			<input type="hidden" name="b" value={batch} />
			<input
				type="hidden"
				name="cf-turnstile-response"
				value={turnstileToken ?? ''}
			/>
			<input
				type="text"
				name={MODEL_INTAKE_HONEYPOT_FIELD}
				tabIndex={-1}
				autoComplete="off"
				className="hidden"
				aria-hidden="true"
			/>

			<div className="grid gap-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="name">{copy.fields.name.label}</Label>
					<Input
						id="name"
						name="name"
						required
						autoComplete="name"
						defaultValue={fields?.name}
						placeholder={copy.fields.name.placeholder}
						aria-invalid={Boolean(errors?.name) || undefined}
						aria-describedby={errors?.name ? 'name-error' : undefined}
					/>
					<FieldError id="name-error" message={say(errors?.name)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="email">{copy.fields.email.label}</Label>
					<Input
						id="email"
						name="email"
						type="email"
						required
						autoComplete="email"
						defaultValue={fields?.email}
						placeholder={copy.fields.email.placeholder}
						aria-invalid={Boolean(errors?.email) || undefined}
						aria-describedby={errors?.email ? 'email-error' : undefined}
					/>
					<FieldError id="email-error" message={say(errors?.email)} />
				</div>
			</div>

			<div className="grid gap-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="company">{copy.fields.company.label}</Label>
					<Input
						id="company"
						name="company"
						required
						autoComplete="organization"
						defaultValue={fields?.company}
						aria-invalid={Boolean(errors?.company) || undefined}
						aria-describedby={errors?.company ? 'company-error' : undefined}
					/>
					<FieldError id="company-error" message={say(errors?.company)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="productType">{copy.fields.productType.label}</Label>
					<Select value={productType} onValueChange={setProductType}>
						<SelectTrigger
							id="productType"
							className="w-full"
							aria-invalid={Boolean(errors?.productType) || undefined}
							aria-describedby={
								errors?.productType ? 'productType-error' : undefined
							}
						>
							<SelectValue placeholder={copy.fields.productType.placeholder} />
						</SelectTrigger>
						<SelectContent>
							{MODEL_INTAKE_PRODUCT_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{copy.fields.productType.options[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input type="hidden" name="productType" value={productType} />
					{errors?.productType ? (
						<FieldError
							id="productType-error"
							message={say(errors.productType)}
						/>
					) : productType === 'other' ? (
						<p className="text-muted-foreground text-body-sm">
							{copy.fields.productType.otherHint}
						</p>
					) : null}
				</div>
			</div>

			<fieldset className="space-y-2">
				<legend className="text-sm leading-none font-medium">
					{copy.fields.photos.label}
				</legend>
				<p id="photos-help" className="text-muted-foreground text-body-sm">
					{copy.fields.photos.help}
				</p>
				<PhotoSlots
					labels={copy.fields.photos}
					invalidIndex={photosInvalidIndex}
					describedBy={photosError ? 'photos-error' : 'photos-help'}
					onTooLarge={(n, tooLarge) =>
						setTooLargeIndex((current) =>
							tooLarge ? n : current === n ? null : current
						)
					}
				/>
				<FieldError id="photos-error" message={photosError} />
			</fieldset>

			<fieldset className="space-y-2">
				<legend className="text-sm leading-none font-medium">
					{copy.fields.size.label}
				</legend>
				<div className="grid grid-cols-3 gap-3">
					{MODEL_INTAKE_SIZE_FIELDS.map((part) => (
						<div key={part} className="space-y-1.5">
							<Label htmlFor={part} className="text-label-xs font-normal">
								{copy.fields.size.parts[part]}
							</Label>
							<Input
								id={part}
								name={part}
								inputMode="decimal"
								defaultValue={fields?.[part]}
								aria-invalid={Boolean(errors?.size) || undefined}
								aria-describedby={errors?.size ? 'size-error' : 'size-help'}
							/>
						</div>
					))}
				</div>
				{errors?.size ? (
					<FieldError id="size-error" message={say(errors.size)} />
				) : (
					<p id="size-help" className="text-muted-foreground text-body-sm">
						{copy.fields.size.help}
					</p>
				)}
			</fieldset>

			<div className="space-y-2">
				<Label htmlFor="message">{copy.fields.message.label}</Label>
				<Textarea
					id="message"
					name="message"
					rows={4}
					maxLength={MODEL_INTAKE_MAX_MESSAGE_LENGTH}
					defaultValue={fields?.message}
					placeholder={copy.fields.message.placeholder}
					aria-invalid={Boolean(errors?.message) || undefined}
					aria-describedby={errors?.message ? 'message-error' : undefined}
				/>
				<FieldError id="message-error" message={say(errors?.message)} />
			</div>

			<div className="space-y-4">
				{(['consentFollowUp', 'consentPhotos'] as const).map((name) => (
					<div key={name} className="space-y-1.5">
						<div className="flex items-start gap-3">
							<Checkbox
								id={name}
								name={name}
								required
								className="mt-0.5"
								aria-invalid={Boolean(errors?.[name]) || undefined}
								aria-describedby={errors?.[name] ? `${name}-error` : undefined}
							/>
							<Label htmlFor={name} className="text-body-sm font-normal">
								{copy.fields[name]}
							</Label>
						</div>
						<FieldError id={`${name}-error`} message={say(errors?.[name])} />
					</div>
				))}
			</div>

			<TurnstileWidget
				siteKey={turnstileSiteKey}
				onSuccess={onTurnstileSuccess}
				resetNonce={turnstileResetNonce}
				onError={onTurnstileError}
			/>

			<div role="status" className="empty:hidden">
				{turnstileFailed && (
					<InlineNotice tone="warning">
						{copy.turnstileFailed}{' '}
						<a href="mailto:info@vectreal.com" className="underline">
							info@vectreal.com
						</a>
						.
					</InlineNotice>
				)}
			</div>

			<div className="space-y-3">
				<Button
					type="submit"
					size="lg"
					disabled={
						isSubmitting ||
						(Boolean(turnstileSiteKey) && turnstileToken === null)
					}
				>
					{isSubmitting ? copy.submitting : copy.submit}
				</Button>
				<p className="text-muted-foreground text-body-sm">
					{copy.privacyNote}{' '}
					<Link
						to="/privacy-policy"
						className="decoration-muted-foreground underline underline-offset-4"
					>
						{copy.privacyLink}
					</Link>
				</p>
			</div>
		</Form>
	)
}
