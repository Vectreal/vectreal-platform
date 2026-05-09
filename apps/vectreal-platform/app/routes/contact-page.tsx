import { usePostHog } from '@posthog/react'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
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
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
	AlertCircle,
	CheckCircle2,
	LifeBuoy,
	Mail,
	Sparkles,
	Users
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { data, Form, Link, useLoaderData, useNavigation } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { PublicErrorBoundary } from '../components/errors'
import { TurnstileWidget } from '../components/turnstile-widget'
import {
	CONTACT_HONEYPOT_FIELD,
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
const HONEYPOT_FIELD = CONTACT_HONEYPOT_FIELD

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
	const initialTrackedRef = useRef(false)

	const initialInquiryType = typedActionData?.fields?.inquiryType ?? 'support'
	const [inquiryType, setInquiryType] =
		useState<InquiryType>(initialInquiryType)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [turnstileResetNonce, setTurnstileResetNonce] = useState(0)
	const [isResultDismissed, setIsResultDismissed] = useState(false)
	const prefersReducedMotion = useReducedMotion()
	const submissionView = getContactSubmissionView(typedActionData)
	const showSubmissionResult = !isResultDismissed && submissionView !== 'form'

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

	useEffect(() => {
		if (initialTrackedRef.current) {
			return
		}
		initialTrackedRef.current = true
		posthog?.capture('contact_page_viewed', {
			source,
			is_authenticated: isAuthenticated,
			client_type: 'web'
		})
	}, [isAuthenticated, posthog, source])

	const isSubmitting = navigation.state === 'submitting'

	return (
		<main className="from-accent/10 relative isolate overflow-hidden bg-gradient-to-b via-transparent to-transparent px-6 py-20 pt-32 md:px-8">
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--accent)/0.16),transparent_42%),radial-gradient(circle_at_85%_10%,hsl(var(--accent)/0.1),transparent_45%)]" />
			<div className="mx-auto max-w-6xl space-y-10">
				<section className="space-y-4 text-left">
					<h1 className="text-4xl font-normal tracking-tight sm:text-5xl">
						Tell us what you are building
					</h1>
					<p className="text-muted-foreground max-w-2xl text-lg">
						Whether you need product support, a business plan discussion, or a
						partnership conversation, this form routes you straight to the right
						team.
					</p>
				</section>

				<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
					<Card className="border-accent/25 rounded-3xl shadow-none">
						<CardHeader>
							<CardTitle className="text-2xl">Send a Message</CardTitle>
							<CardDescription>
								We usually respond within one business day.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<AnimatePresence mode="wait" initial={false}>
								{showSubmissionResult ? (
									<motion.section
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
										className="space-y-4 rounded-2xl border p-6"
									>
										{submissionView === 'success' ? (
											<div className="border-success/50 bg-success/25 text-success-foreground/80 space-y-4 rounded-2xl border p-5">
												<div className="flex items-center gap-2 font-medium">
													<CheckCircle2 className="h-5 w-5" />
													Your message has been sent
												</div>
												<p className="text-success-foreground/70 text-sm">
													Thanks for reaching out. Our team will get back to
													you within one business day.
												</p>
												{typedActionData?.referenceCode ? (
													<p className="text-success-foreground/70 text-sm">
														Reference code:{' '}
														<span className="font-semibold">
															{typedActionData.referenceCode}
														</span>
													</p>
												) : null}
												{typedActionData?.notice ? (
													<p className="text-warning-muted-foreground text-sm">
														{typedActionData.notice}
													</p>
												) : null}
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setIsResultDismissed(true)
														setTurnstileToken(null)
														setTurnstileResetNonce((current) => current + 1)
													}}
												>
													Send another message
												</Button>
											</div>
										) : (
											<div className="border-error-border bg-error-bg text-error-foreground space-y-4 rounded-2xl border p-5">
												<div className="flex items-center gap-2 font-medium">
													<AlertCircle className="h-5 w-5" />
													We could not send your message
												</div>
												<p className="text-sm">
													{typedActionData?.formError ??
														'Please try again in a moment.'}
												</p>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setIsResultDismissed(true)
														setTurnstileToken(null)
														setTurnstileResetNonce((current) => current + 1)
													}}
												>
													Try again
												</Button>
											</div>
										)}
									</motion.section>
								) : (
									<motion.div
										key="form"
										initial={
											prefersReducedMotion ? false : { opacity: 0, y: 8 }
										}
										animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
										exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										<Form
											method="post"
											className="space-y-5"
											onSubmit={() => {
												posthog?.capture('contact_form_submit_started', {
													inquiry_type: inquiryType,
													is_authenticated: isAuthenticated,
													client_type: 'web'
												})
											}}
										>
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
														defaultValue={typedActionData?.fields?.name ?? ''}
														placeholder="Jane Doe"
													/>
													{typedActionData?.fieldErrors?.name ? (
														<p className="text-destructive text-sm">
															{typedActionData.fieldErrors.name}
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
														defaultValue={typedActionData?.fields?.email ?? ''}
														placeholder="you@company.com"
													/>
													{typedActionData?.fieldErrors?.email ? (
														<p className="text-destructive text-sm">
															{typedActionData.fieldErrors.email}
														</p>
													) : null}
												</div>
											</div>

											<div className="space-y-2">
												<Label htmlFor="inquiryType">Inquiry type</Label>
												<Select
													value={inquiryType}
													onValueChange={(value) => {
														setInquiryType(value as InquiryType)
													}}
												>
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
												<input
													type="hidden"
													name="inquiryType"
													value={inquiryType}
												/>
												{typedActionData?.fieldErrors?.inquiryType ? (
													<p className="text-destructive text-sm">
														{typedActionData.fieldErrors.inquiryType}
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
													defaultValue={typedActionData?.fields?.message ?? ''}
													placeholder="Tell us about your use case, current blockers, and timeline."
												/>
												{typedActionData?.fieldErrors?.message ? (
													<p className="text-destructive text-sm">
														{typedActionData.fieldErrors.message}
													</p>
												) : (
													<p className="text-muted-foreground text-xs">
														No sensitive credentials or private keys, please.
													</p>
												)}
											</div>

											<TurnstileWidget
												siteKey={turnstileSiteKey}
												onSuccess={setTurnstileToken}
												resetNonce={turnstileResetNonce}
												onError={() => {
													setTurnstileToken(null)
												}}
											/>

											<div className="flex flex-wrap items-center gap-3">
												<Button
													type="submit"
													size="lg"
													disabled={
														isSubmitting ||
														(Boolean(turnstileSiteKey) &&
															turnstileToken === null)
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
									</motion.div>
								)}
							</AnimatePresence>
						</CardContent>
					</Card>

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
