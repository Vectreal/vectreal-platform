import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Route } from './+types/onboarding-page'
import {
	CONTENT_VARIANTS,
	type DocLink,
	STEPS,
	VISUAL_VARIANTS
} from './onboarding-steps'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)
	return Response.json({ user }, { headers: new Headers(headers) })
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

const DocCard = ({ label, to, description, icon: Icon }: DocLink) => (
	<Link
		to={to}
		className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-3 transition-all duration-200 hover:border-[rgba(252,108,24,0.3)] hover:bg-[rgba(252,108,24,0.05)]"
	>
		<div
			className="flex size-9 shrink-0 items-center justify-center rounded-lg"
			style={{
				background: 'rgba(252,108,24,0.1)',
				border: '1px solid rgba(252,108,24,0.2)'
			}}
		>
			<Icon className="size-4" style={{ color: '#fc6c18' }} />
		</div>
		<div className="min-w-0 flex-1">
			<p className="text-sm font-medium text-white/80">{label}</p>
			<p className="mt-0.5 text-xs text-white/35">{description}</p>
		</div>
		<ArrowRight className="size-3.5 shrink-0 text-white/15 transition-colors duration-200 group-hover:text-[#fc6c18]" />
	</Link>
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

	const navigateTo = (index: number) => {
		setDirection(index > currentStep ? 1 : -1)
		setCompletedSteps((prev) => new Set(prev).add(currentStep))
		setCurrentStep(index)
	}

	return (
		<MotionConfig reducedMotion="user">
			<div className="bg-background flex h-screen w-screen overflow-hidden">
				{/* ── Left panel: animated visual ────────────────────────────── */}
				<div className="relative hidden flex-[3] overflow-hidden md:flex">
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
				<div className="border-border/20 bg-background flex w-full flex-col border-l md:flex-[2]">
					{/* Header */}
					<header className="flex shrink-0 items-center justify-between px-10 pt-8 pb-6">
						<Link to="/" aria-label="Home">
							<VectrealLogoAnimated
								className="text-muted-foreground h-5"
								colored
							/>
						</Link>
						<Link to="/dashboard">
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground/50 hover:text-muted-foreground h-8 text-xs"
							>
								Skip
							</Button>
						</Link>
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

								{/* Doc card */}
								<DocCard {...step.docLink} />
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

						{/* Back / Next */}
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

							{isLast ? (
								<Button
									asChild
									size="sm"
									className="min-w-[130px] font-semibold"
									style={{ background: 'var(--orange)' }}
								>
									<Link to="/dashboard" className="flex items-center gap-1.5">
										<LayoutDashboard className="h-3.5 w-3.5" />
										Go to Dashboard
									</Link>
								</Button>
							) : (
								<Button
									size="sm"
									onClick={() => navigateTo(currentStep + 1)}
									className="min-w-[130px] font-semibold"
								>
									Continue
									<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</MotionConfig>
	)
}

export default OnboardingPage
