import { Button } from '@shared/components/ui/button'
import { ArrowDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { data, useNavigation } from 'react-router'

import { PublicErrorBoundary } from '../components/errors'
import { SheetFrame } from '../components/layout-components'
import { ModelIntakeForm, ModelIntakeResult } from '../components/model-intake'
import { IntakeHero } from '../components/model-intake/intake-hero'
import { routeErrorMeta } from '../components/not-found'
import { MODEL_INTAKE_COPY } from '../constants/product-copy'
import { captureServerEvent } from '../lib/domain/analytics/server-events.server'
import {
	lookupIntakeLetter,
	resolveIntakeLetter
} from '../lib/domain/model-intake/model-intake-letter.server'
import { resolveIntakeScene } from '../lib/domain/model-intake/model-intake-scene.server'
import {
	intakeLetterAsksClientConsent,
	isIntakeBodyAcceptable,
	MODEL_INTAKE_LETTER_PARAM,
	MODEL_INTAKE_RETENTION_DAYS,
	type ModelIntakeActionData,
	normalizeIntakeLetterCode,
	resolveIntakeBatch,
	resolveIntakeLocale
} from '../lib/domain/model-intake/model-intake-shared'
import { submitModelIntake } from '../lib/domain/model-intake/model-intake-submission.server'
import { ensureValidCsrfFormData } from '../lib/http/csrf.server'
import { verifyTurnstileToken } from '../lib/http/turnstile.server'
import { reportServerError } from '../lib/observability/report-server-error.server'
import { buildPageMeta } from '../lib/seo'
import { shareCardMeta } from '../lib/share-cards'

import type { Route } from './+types/free-model-page'
import type { PostHogContext } from '../lib/posthog/posthog-middleware'

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const letter = await resolveIntakeLetter(
		request,
		url.searchParams.get(MODEL_INTAKE_LETTER_PARAM)
	)
	return {
		locale: resolveIntakeLocale(url.searchParams.get('lang')),
		batch: resolveIntakeBatch(url.searchParams.get('b')),
		/** Kept even when the lookup missed, so the submit and the language switch still carry it. */
		letterCode: normalizeIntakeLetterCode(
			url.searchParams.get(MODEL_INTAKE_LETTER_PARAM)
		),
		letter,
		// A brand letter's card shows one product; the page turns that one.
		scene: await resolveIntakeScene(request, letter?.showcase ?? null),
		asksClientConsent: intakeLetterAsksClientConsent(letter),
		turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''
	}
}

export async function action({ request, context }: Route.ActionArgs) {
	if (!isIntakeBodyAcceptable(request.headers.get('content-length'))) {
		// Refused unread. The form checks each photo's size before sending, so a
		// browser only gets here if that check was bypassed.
		return data<ModelIntakeActionData>(
			{ status: 'error', formError: 'server' },
			{ status: 413 }
		)
	}

	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const lang = formData.get('lang')
	const b = formData.get('b')
	const locale = resolveIntakeLocale(typeof lang === 'string' ? lang : null)
	const batch = resolveIntakeBatch(typeof b === 'string' ? b : null)
	const posthog = (context as PostHogContext).posthog
	const distinctId =
		request.headers.get('X-POSTHOG-DISTINCT-ID') ?? 'model-intake-anonymous'

	const token = formData.get('cf-turnstile-response')
	const verification = await verifyTurnstileToken(
		typeof token === 'string' ? token : '',
		request
	)
	if (!verification.success) {
		captureServerEvent(posthog, request, distinctId, {
			name: 'model_intake_blocked',
			props: { block_reason: 'turnstile', batch, locale }
		})
		return data<ModelIntakeActionData>(
			{ status: 'error', formError: 'bot' },
			{ status: 400 }
		)
	}

	try {
		const c = formData.get(MODEL_INTAKE_LETTER_PARAM)
		const letter = await lookupIntakeLetter(
			request,
			normalizeIntakeLetterCode(typeof c === 'string' ? c : null)
		)
		const result = await submitModelIntake({
			request,
			formData,
			locale,
			batch,
			letter,
			intakePageUrl: new URL('/dashboard/intake', request.url).toString()
		})
		captureServerEvent(posthog, request, distinctId, {
			name:
				result.outcome === 'submitted'
					? 'model_intake_submitted'
					: result.outcome === 'honeypot' || result.outcome === 'rate_limit'
						? 'model_intake_blocked'
						: 'model_intake_submit_failed',
			props: {
				outcome: result.outcome,
				batch,
				locale,
				from_letter: letter !== null
			}
		})
		return data<ModelIntakeActionData>(result.body, { status: result.status })
	} catch (error) {
		reportServerError(error, { request, properties: { batch, locale } })
		return data<ModelIntakeActionData>(
			{ status: 'error', formError: 'server' },
			{ status: 500 }
		)
	}
}

export function meta({ error, loaderData }: Route.MetaArgs) {
	if (error) return routeErrorMeta(error)
	const locale = loaderData?.locale ?? 'en'
	return buildPageMeta({
		...MODEL_INTAKE_COPY[locale].meta,
		...shareCardMeta(`free-model-${locale}`),
		canonical: '/free-model'
	})
}

const FORM_ID = 'photos'

export default function FreeModelPage({
	loaderData,
	actionData
}: Route.ComponentProps) {
	const {
		locale,
		batch,
		letterCode,
		letter,
		scene,
		asksClientConsent,
		turnstileSiteKey
	} = loaderData
	const copy = MODEL_INTAKE_COPY[locale]
	const navigation = useNavigation()
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [turnstileFailed, setTurnstileFailed] = useState(false)
	const [turnstileResetNonce, setTurnstileResetNonce] = useState(0)
	const [showForm, setShowForm] = useState(true)

	// A token is spent by the submit it rode on, whatever the answer was.
	useEffect(() => {
		if (!actionData) return
		setShowForm(actionData.status !== 'success')
		setTurnstileToken(null)
		setTurnstileResetNonce((current) => current + 1)
	}, [actionData])

	const formError =
		actionData?.status === 'error' && !actionData.fieldErrors
			? copy.formErrors[actionData.formError]
			: undefined

	return (
		<main lang={locale}>
			<IntakeHero
				greeting={letter ? copy.letterGreeting(letter.organization) : null}
				heading={copy.hero.heading}
				lead={copy.hero.lead}
				scene={scene}
				sceneLabel={copy.hero.sceneLabel}
				action={
					<Button
						asChild
						size="lg"
						variant="brand"
						className="tap-target w-full sm:w-fit"
					>
						<a href={`#${FORM_ID}`}>
							{copy.hero.action}
							<ArrowDown aria-hidden="true" />
						</a>
					</Button>
				}
			/>

			{/* The form and what happens next are two cells of one row under the head, as on /contact. */}
			<SheetFrame>
				<div className="border-foreground/10 border-t">
					<div className="mx-(--frame-x) grid lg:grid-cols-[1.15fr_0.85fr]">
						<section
							id={FORM_ID}
							className="border-foreground/10 scroll-mt-4 space-y-6 py-16 lg:border-r lg:px-(--frame-pad) lg:py-24"
						>
							<h2 className="sr-only">{copy.submit}</h2>
							{actionData?.status === 'success' && !showForm ? (
								<ModelIntakeResult
									locale={locale}
									referenceCode={actionData.referenceCode}
									confirmationFailed={actionData.confirmationFailed}
									onAgain={() => setShowForm(true)}
								/>
							) : (
								<>
									{formError ? (
										<p role="alert" className="text-destructive text-body-sm">
											{formError}
										</p>
									) : null}
									<ModelIntakeForm
										locale={locale}
										batch={batch}
										letterCode={letterCode}
										asksClientConsent={asksClientConsent}
										turnstileSiteKey={turnstileSiteKey}
										turnstileToken={turnstileToken}
										onTurnstileSuccess={(next) => {
											setTurnstileToken(next)
											setTurnstileFailed(false)
										}}
										onTurnstileError={() => {
											setTurnstileToken(null)
											setTurnstileFailed(true)
										}}
										turnstileFailed={turnstileFailed}
										turnstileResetNonce={turnstileResetNonce}
										isSubmitting={navigation.state === 'submitting'}
										actionData={showForm ? actionData : undefined}
									/>
								</>
							)}
						</section>

						<section className="border-foreground/10 space-y-4 border-t py-16 lg:border-t-0 lg:px-(--frame-pad) lg:py-24">
							<h2 className="text-h4">{copy.next.heading}</h2>
							<ol className="text-body-sm list-decimal space-y-3 pl-5">
								{copy.next.steps.map((step) => (
									<li key={step}>{step}</li>
								))}
							</ol>
							<p className="text-muted-foreground text-body-sm">
								{copy.next.note}
							</p>
							<p className="text-muted-foreground text-body-sm">
								{copy.next.retention(MODEL_INTAKE_RETENTION_DAYS)}
							</p>
						</section>
					</div>
				</div>
			</SheetFrame>
		</main>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
