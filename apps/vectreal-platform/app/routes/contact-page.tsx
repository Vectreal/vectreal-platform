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
import { CheckCircle2, LifeBuoy, Mail, Sparkles, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { data, Form, Link, useLoaderData, useNavigation } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import {
	CONTACT_HONEYPOT_FIELD,
	CONTACT_SOURCE_VALUES,
	type ContactActionData,
	type ContactInquiryType
} from '../lib/domain/contact/contact-shared'
import {
	buildContactSource,
	submitContactForm
} from '../lib/domain/contact/contact-submission.server'
import { ensureValidCsrfFormData } from '../lib/http/csrf.server'
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
		{ source: buildContactSource(request), isAuthenticated: Boolean(user) },
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

	const rawSource = formData.get('source')
	const source = CONTACT_SOURCE_VALUES.includes(
		rawSource as (typeof CONTACT_SOURCE_VALUES)[number]
	)
		? (rawSource as (typeof CONTACT_SOURCE_VALUES)[number])
		: ('other' as const)
	const result = await submitContactForm({
		request,
		context,
		formData,
		userId: user?.id ?? null,
		isAuthenticated: Boolean(user),
		source
	})

	return data<ActionData>(result.body, {
		status: result.status,
		headers: responseHeaders
	})
}

export function meta(_: Route.MetaArgs) {
	return buildPageMeta(LEGAL_PAGE_SEO_BY_PATH['/contact'])
}

export default function ContactPage({ actionData }: Route.ComponentProps) {
	const { source, isAuthenticated } = useLoaderData<typeof loader>()
	const typedActionData = actionData as ActionData | undefined
	const posthog = usePostHog()
	const navigation = useNavigation()
	const initialTrackedRef = useRef(false)

	const initialInquiryType = typedActionData?.fields?.inquiryType ?? 'support'
	const [inquiryType, setInquiryType] =
		useState<InquiryType>(initialInquiryType)

	useEffect(() => {
		setInquiryType(initialInquiryType)
	}, [initialInquiryType])

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
							{typedActionData?.status === 'success' ? (
								<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
									<p className="flex items-center gap-2 font-medium">
										<CheckCircle2 className="h-4 w-4" />
										Message sent successfully
									</p>
									<p className="mt-2 text-sm text-emerald-700">
										Thanks for reaching out. We will get back to you shortly.
									</p>
									{typedActionData.referenceCode ? (
										<p className="mt-2 text-sm text-emerald-700">
											Reference code:{' '}
											<span className="font-semibold">
												{typedActionData.referenceCode}
											</span>
										</p>
									) : null}
									{typedActionData.notice ? (
										<p className="mt-2 text-sm text-amber-700">
											{typedActionData.notice}
										</p>
									) : null}
								</div>
							) : null}

							{typedActionData?.status === 'error' &&
							typedActionData.formError ? (
								<div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
									{typedActionData.formError}
								</div>
							) : null}

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
											<p className="text-sm text-red-600">
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
											<p className="text-sm text-red-600">
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
									<input type="hidden" name="inquiryType" value={inquiryType} />
									{typedActionData?.fieldErrors?.inquiryType ? (
										<p className="text-sm text-red-600">
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
										<p className="text-sm text-red-600">
											{typedActionData.fieldErrors.message}
										</p>
									) : (
										<p className="text-muted-foreground text-xs">
											No sensitive credentials or private keys, please.
										</p>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-3">
									<Button type="submit" size="lg" disabled={isSubmitting}>
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
