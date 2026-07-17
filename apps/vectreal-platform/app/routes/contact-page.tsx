import { usePostHog } from '@posthog/react'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LifeBuoy, Mail, Sparkles, Users } from 'lucide-react'
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
		console.error('[contact/action] failed to process contact submission', {
			error,
			source,
			isAuthenticated: Boolean(user)
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
				eyebrow="Contact"
				heading="Tell us what you are building"
				description="Whether you need product support, a business plan discussion, or a partnership conversation, this form routes you straight to the right team."
			/>

			<div className="mx-auto max-w-7xl px-6 pb-20">
				<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
					<BasicCard>
						<CardHeader>
							<CardTitle className="text-2xl">Send a Message</CardTitle>
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
						<Card className="border-accent/20 rounded-3xl shadow-none">
							<CardHeader>
								<CardTitle className="text-lg">
									Routes to the right team
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4 text-sm">
								<div className="flex items-start gap-3">
									<LifeBuoy className="text-accent mt-0.5 h-4 w-4" />
									<div>
										<p className="font-medium">Support</p>
										<p className="text-muted-foreground">
											Integration issues, bugs, or workflow questions.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3">
									<Sparkles className="text-accent mt-0.5 h-4 w-4" />
									<div>
										<p className="font-medium">Sales</p>
										<p className="text-muted-foreground">
											Business and enterprise questions, security review, and
											custom contracts.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3">
									<Users className="text-accent mt-0.5 h-4 w-4" />
									<div>
										<p className="font-medium">Partnerships</p>
										<p className="text-muted-foreground">
											Agencies, platform partnerships, and ecosystem
											collaboration.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="border-accent/20 rounded-3xl shadow-none">
							<CardHeader>
								<CardTitle className="text-lg">Quick links</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								<Link className="text-accent block underline" to="/pricing">
									View pricing and plans
								</Link>
								<Link className="text-accent block underline" to="/docs">
									Read integration docs
								</Link>
								<a
									className="text-accent block underline"
									href="mailto:info@vectreal.com"
								>
									Email the team directly
								</a>
								<p className="text-muted-foreground flex items-center gap-2 pt-2 text-xs">
									<Mail className="h-3.5 w-3.5" />
									We usually reply within one business day.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</main>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
