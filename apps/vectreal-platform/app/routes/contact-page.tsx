import { usePostHog } from '@posthog/react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
	data,
	Link,
	useLoaderData,
	useNavigation,
	useSearchParams
} from 'react-router'

import {
	ContactErrorResult,
	ContactForm,
	ContactSuccessResult
} from '../components/contact'
import { PublicErrorBoundary } from '../components/errors'
import { PageHero, SheetFrame } from '../components/layout-components'
import { routeErrorMeta } from '../components/not-found'
import {
	PILOT_CONTACT_PROMPT,
	PILOT_CONTACT_TOPIC
} from '../constants/product-copy'
import {
	CONTACT_SOURCE_VALUES,
	type ContactActionData,
	type ContactInquiryType,
	getContactSubmissionView
} from '../lib/domain/contact/contact-shared'
import {
	buildContactSource,
	submitContactForm
} from '../lib/domain/contact/contact-submission.server'
import { ensureValidCsrfFormData } from '../lib/http/csrf.server'
import { verifyTurnstileToken } from '../lib/http/turnstile.server'
import { reportServerError } from '../lib/observability/report-server-error.server'
import { buildPageMeta } from '../lib/seo'
import { LEGAL_PAGE_SEO_BY_PATH } from '../lib/seo-registry'
import { createSupabaseClient } from '../lib/supabase.server'

import type { Route } from './+types/contact-page'

type InquiryType = ContactInquiryType
type ActionData = ContactActionData

export async function loader({ request }: Route.LoaderArgs) {
	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	return {
		source: buildContactSource(request),
		isAuthenticated: Boolean(user),
		turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''
	}
}

export async function action({ request, context }: Route.ActionArgs) {
	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const turnstileToken = formData.get('cf-turnstile-response')
	const verification = await verifyTurnstileToken(
		typeof turnstileToken === 'string' ? turnstileToken : '',
		request
	)
	if (!verification.success) {
		return data<ActionData>(
			{
				status: 'error',
				formError: 'Bot verification failed. Please try again.'
			},
			{ status: 400 }
		)
	}

	const rawSource = formData.get('source')
	const source = CONTACT_SOURCE_VALUES.includes(
		rawSource as (typeof CONTACT_SOURCE_VALUES)[number]
	)
		? (rawSource as (typeof CONTACT_SOURCE_VALUES)[number])
		: ('other' as const)
	let result: { status: number; body: ActionData }

	try {
		result = await submitContactForm({
			request,
			context,
			formData,
			userId: user?.id ?? null,
			isAuthenticated: Boolean(user),
			source
		})
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { source, isAuthenticated: Boolean(user) }
		})

		result = {
			status: 500,
			body: {
				status: 'error',
				formError:
					'We could not send your message right now. Please try again shortly.'
			}
		}
	}

	return data<ActionData>(result.body, { status: result.status })
}

export function meta({ error }: Route.MetaArgs) {
	if (error) return routeErrorMeta(error)
	return buildPageMeta(LEGAL_PAGE_SEO_BY_PATH['/contact'])
}

/*
  Brand orange on the light page measures 2.88:1, below AA for body text, so the
  accent marks the link through its underline rather than by colouring the text.

  The underline is `decoration-muted-foreground`, not `decoration-border`:
  `--border` against `--background` is about 1.1:1, which removed the resting
  affordance along with the colour and left a reader with no cue that the text
  was a link at all.
*/
const LINK_CLASS =
	'text-body-sm block underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 hover:decoration-orange'

const CONTACT_ROUTING = [
	{
		term: 'Support',
		definition: 'Integration issues, bugs, or workflow questions.'
	},
	{
		term: 'Sales',
		definition:
			'Business and enterprise questions, security review, and custom contracts.'
	}
] as const

export default function ContactPage({ actionData }: Route.ComponentProps) {
	const { source, isAuthenticated, turnstileSiteKey } =
		useLoaderData<typeof loader>()
	const typedActionData = actionData as ActionData | undefined
	const posthog = usePostHog()
	const navigation = useNavigation()

	// A pilot is a sales conversation with its own questions, not an inquiry type of its own.
	const [searchParams] = useSearchParams()
	const isPilot = searchParams.get('topic') === PILOT_CONTACT_TOPIC
	const initialInquiryType =
		typedActionData?.fields?.inquiryType ?? (isPilot ? 'sales' : 'support')
	const [inquiryType, setInquiryType] =
		useState<InquiryType>(initialInquiryType)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [turnstileFailed, setTurnstileFailed] = useState(false)
	const [turnstileResetNonce, setTurnstileResetNonce] = useState(0)
	const [isResultDismissed, setIsResultDismissed] = useState(false)
	const prefersReducedMotion = useReducedMotion()
	const submissionView = getContactSubmissionView(typedActionData)
	const showSubmissionResult = !isResultDismissed && submissionView !== 'form'
	const isSubmitting = navigation.state === 'submitting'

	useEffect(() => {
		setInquiryType(initialInquiryType)
	}, [initialInquiryType])

	useEffect(() => {
		if (!typedActionData) {
			return
		}

		setIsResultDismissed(false)
		setTurnstileToken(null)
		setTurnstileResetNonce((current) => current + 1)
	}, [typedActionData])

	const handleDismissResult = () => {
		setIsResultDismissed(true)
		setTurnstileToken(null)
		setTurnstileResetNonce((current) => current + 1)
	}

	const handleTurnstileSuccess = (token: string) => {
		setTurnstileToken(token)
		setTurnstileFailed(false)
	}

	const handleTurnstileError = () => {
		setTurnstileToken(null)
		setTurnstileFailed(true)
	}

	const handleSubmit = () => {
		posthog?.capture('contact_form_submit_started', {
			inquiry_type: inquiryType,
			is_authenticated: isAuthenticated
		})
	}

	return (
		<main>
			<PageHero
				heading="Tell us what you are building"
				description={
					<>
						{isPilot && <span className="block">{PILOT_CONTACT_PROMPT}</span>}
						We usually respond within one business day.
					</>
				}
			/>

			{/*
			  The head runs edge to edge above the frame. Below it the form and the
			  notes beside it are two cells of one row, starting on the rule under
			  the head, with a column rule between them rather than a card around
			  the form.
			*/}
			<SheetFrame>
				<div className="border-foreground/10 border-t">
					<div className="mx-(--frame-x) grid lg:grid-cols-[1.15fr_0.85fr]">
						<section className="border-foreground/10 space-y-6 py-16 lg:border-r lg:px-(--frame-pad) lg:py-24">
							{/*
							  No visible header: what it would say is the page's description.
							  The heading stays for screen readers, so the form is still a
							  section the page can be navigated by.
							*/}
							<h2 className="sr-only">Send a message</h2>
							{/* A brand with one product and only photos has a shorter way in than a message. */}
							<p className="text-body-sm text-muted-foreground">
								One product?{' '}
								<Link
									to="/free-model"
									className="text-foreground decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150"
								>
									Send three photos and get a free model.
								</Link>
							</p>
							<AnimatePresence mode="wait" initial={false}>
								{showSubmissionResult ? (
									<motion.div
										key={`result-${submissionView}`}
										initial={
											prefersReducedMotion
												? false
												: { opacity: 0, y: 8, scale: 0.98 }
										}
										animate={
											prefersReducedMotion
												? undefined
												: { opacity: 1, y: 0, scale: 1 }
										}
										exit={
											prefersReducedMotion
												? undefined
												: { opacity: 0, y: -8, scale: 0.98 }
										}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										{submissionView === 'success' ? (
											<ContactSuccessResult
												referenceCode={typedActionData?.referenceCode}
												notice={typedActionData?.notice}
												onDismiss={handleDismissResult}
											/>
										) : (
											<ContactErrorResult
												error={typedActionData?.formError}
												onDismiss={handleDismissResult}
											/>
										)}
									</motion.div>
								) : (
									<motion.div
										key="form"
										initial={
											prefersReducedMotion ? false : { opacity: 0, y: 8 }
										}
										animate={
											prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
										}
										exit={
											prefersReducedMotion ? undefined : { opacity: 0, y: -8 }
										}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										<ContactForm
											source={source}
											isAuthenticated={isAuthenticated}
											inquiryType={inquiryType}
											onInquiryTypeChange={setInquiryType}
											turnstileSiteKey={turnstileSiteKey}
											turnstileToken={turnstileToken}
											onTurnstileSuccess={handleTurnstileSuccess}
											onTurnstileError={handleTurnstileError}
											turnstileFailed={turnstileFailed}
											turnstileResetNonce={turnstileResetNonce}
											isSubmitting={isSubmitting}
											actionData={typedActionData}
											onSubmit={handleSubmit}
										/>
									</motion.div>
								)}
							</AnimatePresence>
						</section>

						<div className="border-foreground/10 space-y-12 border-t py-16 lg:border-t-0 lg:px-(--frame-pad) lg:py-24">
							<section>
								<h2 className="text-h4 mb-4">Where this goes</h2>
								{/*
								  A definition list, not icon-title-description
								  rows. The icons were decorative, they were the
								  vertical form of the icon-triplet pattern, and in
								  brand orange they measured 2.88:1 on this page -
								  under the 3:1 floor for a graphical object.
								*/}
								<dl className="space-y-4">
									{CONTACT_ROUTING.map(({ term, definition }) => (
										<div key={term}>
											<dt className="text-body-sm font-medium">{term}</dt>
											<dd className="text-muted-foreground text-body-sm">
												{definition}
											</dd>
										</div>
									))}
								</dl>
							</section>

							<section>
								<h2 className="text-h4 mb-4">Elsewhere</h2>
								<div className="space-y-3">
									<Link className={LINK_CLASS} to="/pricing">
										View pricing and plans
									</Link>
									<Link className={LINK_CLASS} to="/docs">
										Read integration docs
									</Link>
									<a className={LINK_CLASS} href="mailto:info@vectreal.com">
										Email the team directly
									</a>
									<p className="text-muted-foreground text-label-xs flex items-center gap-2 pt-2">
										<Mail className="h-3.5 w-3.5" />
										We usually reply within one business day.
									</p>
								</div>
							</section>
						</div>
					</div>
				</div>
			</SheetFrame>
		</main>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
