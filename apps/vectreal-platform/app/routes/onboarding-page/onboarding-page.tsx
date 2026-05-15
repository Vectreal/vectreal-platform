import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { cn } from '@shared/utils'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, redirect, useFetcher, type MetaFunction } from 'react-router'

import { Route } from './+types/onboarding-page'
import {
	CONTENT_VARIANTS,
	type OnboardingProfile,
	type OnboardingProfileKey,
	STEPS,
	VISUAL_VARIANTS
} from './onboarding-steps'
import { AuthErrorBoundary } from '../../components/errors'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { updateUserProfile } from '../../lib/domain/user/user-repository.server'
import { buildMeta } from '../../lib/seo'

export { AuthErrorBoundary as ErrorBoundary }

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Get Started — Vectreal' },
			{ property: 'og:title', content: 'Get Started — Vectreal' }
		],
		undefined,
		{ private: true }
	)

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)
	return Response.json({ user }, { headers: new Headers(headers) })
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
	const { userWithDefaults, headers } = await loadAuthenticatedUser(request)
	const formData = await request.formData()

	const toNullable = (v: FormDataEntryValue | null): string | null => {
		if (!v || typeof v !== 'string' || v.trim() === '') return null
		return v.trim()
	}

	await updateUserProfile(userWithDefaults.user.id, {
		role: toNullable(formData.get('role')),
		useCase: toNullable(formData.get('useCase')),
		companyName: toNullable(formData.get('companyName')),
		referralSource: toNullable(formData.get('referralSource'))
	})

	return redirect('/dashboard', { headers: new Headers(headers) })
}

// ─── PillGroup ────────────────────────────────────────────────────────────────

const PillGroup = ({
	options,
	value,
	onChange
}: {
	options: ReadonlyArray<{ value: string; label: string }>
	value: string | null
	onChange: (v: string) => void
}) => (
	<div className="flex flex-wrap gap-2">
		{options.map((opt) => {
			const active = value === opt.value
			return (
				<button
					key={opt.value}
					type="button"
					onClick={() => onChange(active ? '' : opt.value)}
					className={cn(
						'rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-150',
						active
							? 'border-[rgba(252,108,24,0.6)] bg-[rgba(252,108,24,0.12)] text-[#fc6c18]'
							: 'border-white/12 bg-white/4 text-white/55 hover:border-white/25 hover:text-white/80'
					)}
				>
					{opt.label}
				</button>
			)
		})}
	</div>
)

// ─── StepDot ──────────────────────────────────────────────────────────────────

const StepDot = ({
	index,
	active,
	completed,
	onClick,
	label
}: {
	index: number
	active: boolean
	completed: boolean
	onClick: () => void
	label: string
}) => (
	<button
		onClick={onClick}
		aria-label={label}
		aria-current={active ? 'step' : undefined}
		className="flex items-center justify-center p-1.5"
	>
		<motion.div
			className="rounded-full"
			animate={{
				width: active ? 28 : 8,
				height: 8,
				backgroundColor: active
					? '#fc6c18'
					: completed
						? 'rgba(252,108,24,0.55)'
						: 'rgba(255,255,255,0.2)'
			}}
			transition={{ type: 'spring', stiffness: 500, damping: 35 }}
		/>
		<span className="sr-only">{`Step ${index + 1}: ${label}`}</span>
	</button>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const OnboardingPage = ({ loaderData }: Route.ComponentProps) => {
	const [currentStep, setCurrentStep] = useState(0)
	const [direction, setDirection] = useState(1)
	const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
	const [profile, setProfile] = useState<OnboardingProfile>({
		role: null,
		useCase: null,
		companyName: null,
		referralSource: null
	})

	const fetcher = useFetcher()
	const textInputRef = useRef<HTMLInputElement>(null)
	const isSubmitting = fetcher.state !== 'idle'

	const rawName =
		(
			loaderData as {
				user?: { user_metadata?: { name?: string }; email?: string }
			}
		)?.user?.user_metadata?.name ??
		(loaderData as { user?: { email?: string } })?.user?.email?.split('@')[0] ??
		null

	const userName = rawName
		?.split(' ')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ')

	const step = STEPS[currentStep]
	const isFirst = currentStep === 0
	const isLast = currentStep === STEPS.length - 1
	const { Visual } = step

	const setField = (key: OnboardingProfileKey, value: string) => {
		setProfile((prev) => ({ ...prev, [key]: value || null }))
	}

	const submitProfile = (partial?: Partial<OnboardingProfile>) => {
		const payload = partial ? { ...profile, ...partial } : profile
		const fd = new FormData()
		for (const [k, v] of Object.entries(payload)) {
			fd.set(k, v ?? '')
		}
		fetcher.submit(fd, { method: 'post' })
	}

	const navigateTo = (index: number) => {
		setDirection(index > currentStep ? 1 : -1)
		setCompletedSteps((prev) => new Set(prev).add(currentStep))
		setCurrentStep(index)
	}

	const handleContinue = () => {
		if (isLast) {
			submitProfile()
		} else {
			navigateTo(currentStep + 1)
		}
	}

	return (
		<MotionConfig reducedMotion="user">
			<div className="bg-background flex h-screen w-screen overflow-hidden">
				{/* ── Left panel: animated visual ────────────────────────────── */}
				<div className="relative hidden flex-3 overflow-hidden md:flex">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={step.id}
							className="absolute inset-0"
							variants={VISUAL_VARIANTS}
							initial="enter"
							animate="center"
							exit="exit"
						>
							<Visual />
						</motion.div>
					</AnimatePresence>
				</div>

				{/* ── Right panel: content + nav ──────────────────────────────── */}
				<div className="border-border/20 bg-background flex w-full flex-col border-l md:flex-2">
					{/* Header */}
					<header className="flex shrink-0 items-center justify-between px-10 pt-8 pb-6">
						<Link to="/" aria-label="Home">
							<VectrealLogoAnimated
								className="text-muted-foreground h-5"
								colored
							/>
						</Link>
						<Button
							variant="ghost"
							size="sm"
							disabled={isSubmitting}
							onClick={() => submitProfile()}
							className="text-muted-foreground/50 hover:text-muted-foreground h-8 text-xs"
						>
							Skip
						</Button>
					</header>

					{/* Mobile visual band */}
					<div className="border-border/20 bg-muted/5 mx-10 mb-6 h-48 shrink-0 overflow-hidden rounded-2xl border md:hidden">
						<Visual />
					</div>

					{/* Animated content */}
					<div className="relative flex flex-1 overflow-hidden">
						<AnimatePresence mode="wait" custom={direction} initial={false}>
							<motion.div
								key={step.id}
								custom={direction}
								variants={CONTENT_VARIANTS}
								initial="enter"
								animate="center"
								exit="exit"
								className="absolute inset-0 flex flex-col justify-center px-10 pb-8"
							>
								{/* Step counter */}
								<p className="mb-4 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">
									{String(currentStep + 1).padStart(2, '0')} /{' '}
									{String(STEPS.length).padStart(2, '0')}
								</p>

								{/* Title */}
								<h1 className="mb-3 text-5xl leading-snug font-medium">
									{step.id === 0 && userName
										? `Hey ${userName}, welcome.`
										: step.title}
								</h1>

								{/* Tagline */}
								<p className="mb-8 text-sm leading-relaxed text-white/50">
									{step.tagline}
								</p>

								{/* Step input */}
								{step.inputType === 'pills' ? (
									<PillGroup
										options={step.options}
										value={profile[step.fieldKey]}
										onChange={(v) => setField(step.fieldKey, v)}
									/>
								) : (
									<Input
										ref={textInputRef}
										placeholder={step.placeholder}
										value={profile[step.fieldKey] ?? ''}
										onChange={(e) => setField(step.fieldKey, e.target.value)}
										className="max-w-xs"
										autoComplete="organization"
									/>
								)}
							</motion.div>
						</AnimatePresence>
					</div>

					{/* Navigation footer */}
					<div className="shrink-0 px-10 pt-4 pb-8">
						{/* Step dots */}
						<div className="mb-5 flex items-center justify-center">
							{STEPS.map((s, i) => (
								<StepDot
									key={s.id}
									index={i}
									active={i === currentStep}
									completed={completedSteps.has(i)}
									onClick={() => navigateTo(i)}
									label={s.title}
								/>
							))}
						</div>

						{/* Back / Continue */}
						<div className="flex items-center justify-between gap-3">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => navigateTo(currentStep - 1)}
								className={cn(
									'min-w-[80px] transition-opacity duration-200',
									isFirst ? 'pointer-events-none opacity-0' : 'opacity-100'
								)}
								tabIndex={isFirst ? -1 : 0}
								aria-hidden={isFirst}
							>
								← Back
							</Button>

							<Button
								size="sm"
								onClick={handleContinue}
								disabled={isSubmitting}
								className="min-w-[130px] font-semibold"
								style={isLast ? { background: 'var(--orange)' } : undefined}
							>
								{isLast ? (
									<>
										<LayoutDashboard className="h-3.5 w-3.5" />
										{isSubmitting ? 'Saving…' : 'Go to Dashboard'}
									</>
								) : (
									<>
										Continue
										<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</MotionConfig>
	)
}

export default OnboardingPage
