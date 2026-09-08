import { usePostHog } from '@posthog/react'
import {
	CardContent,
	CardDescription,
	CardHeader
} from '@shared/components/ui/card'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { data, Link, useLoaderData, useNavigation } from 'react-router'

import {
	ContactErrorResult,
	ContactForm,
	ContactSuccessResult
} from '../components/contact'
import { PublicErrorBoundary } from '../components/errors'
import { BasicCard, PageHero } from '../components/layout-components'
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
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	return data(
		{
			source: buildContactSource(request),
			isAuthenticated: Boolean(user),
			turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''
		},
		{ headers }
	)
}

export async function action({ request, context }: Route.ActionArgs) {
	const { client, headers } = await createSupabaseClient(request)
	const responseHeaders = new Headers(headers)
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
			{ status: 400, headers: responseHeaders }
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

	return data<ActionData>(result.body, {
		status: result.status,
		headers: responseHeaders
	})
}

export function meta(_: Route.MetaArgs) {
	return buildPageMeta(LEGAL_PAGE_SEO_BY_PATH['/contact'])
}

/*
  Brand orange on a light card measures 2.88:1, below AA for body text, so the
  accent marks the link through its underline rather than by colouring the text.

  The underline is `decoration-muted-foreground`, not `decoration-border`:
  `--border` against `--card` is about 1.1:1, which removed the resting
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
	},
	{
		term: 'Partnerships',
		definition: 'Agencies, platform partnerships, and ecosystem collaboration.'
	}
] as const

export default function ContactPage({ actionData }: Route.ComponentProps) {
	const { source, isAuthenticated, turnstileSiteKey } =
		useLoaderData<typeof loader>()
	const typedActionData = actionData as ActionData | undefined
	const posthog = usePostHog()
	const navigation = useNavigation()

	const initialInquiryType = typedActionData?.fields?.inquiryType ?? 'support'
	const [inquiryType, setInquiryType] =
		useState<InquiryType>(initialInquiryType)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
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
	}

	const handleTurnstileError = () => {
		setTurnstileToken(null)
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
				description="Whether you need product support, a business plan discussion, or a partnership conversation, this form routes you straight to the right team."
			/>

			<div className="container-page pb-20">
				<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
					<BasicCard>
						<CardHeader>
							{/*
							  A real <h2>, not CardTitle. CardTitle renders a <div>, so all
							  three section titles on this page were styled text and the page
							  offered nothing below the h1 to navigate by. Its defaults also
							  carry `capitalize`, which is what rendered this "Send A Message"
							  after the copy was deliberately set in sentence case.
							*/}
							<h2 className="text-h3 font-heading">Send a message</h2>
							<CardDescription>
								We usually respond within one business day.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
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
											turnstileResetNonce={turnstileResetNonce}
											isSubmitting={isSubmitting}
											actionData={typedActionData}
											onSubmit={handleSubmit}
										/>
									</motion.div>
								)}
							</AnimatePresence>
						</CardContent>
					</BasicCard>

					<div className="space-y-6">
						<section>
							<CardHeader>
								<h2 className="text-h4">Where this goes</h2>
							</CardHeader>
							<CardContent>
								{/*
								  A definition list, not three icon-title-description
								  rows. The icons were decorative, they were the
								  vertical form of the icon-triplet pattern, and in
								  brand orange they measured 2.88:1 on this card -
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
							</CardContent>
						</section>

						<section>
							<CardHeader>
								<h2 className="text-h4">Elsewhere</h2>
							</CardHeader>
							<CardContent className="space-y-3">
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
							</CardContent>
						</section>
					</div>
				</div>
			</div>
		</main>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
