import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { Progress } from '@shared/components/ui/progress'
import { cn } from '@shared/utils'
import {
	ArrowRight,
	Check,
	Code2,
	ExternalLink,
	FolderOpen,
	Rocket,
	Upload,
	Zap
} from 'lucide-react'
import { useState } from 'react'
import { Link, redirect } from 'react-router'

import { Route } from './+types/onboarding-page'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'

export async function loader({ request }: Route.LoaderArgs) {
	// Only authenticated users should reach this page
	await loadAuthenticatedSession(request)
	return {}
}

interface OnboardingStep {
	id: string
	icon: React.ComponentType<{ className?: string }>
	title: string
	description: string
	detail: string
	qa?: string[]
	cta?: {
		label: string
		to: string
		external?: boolean
	}
}

const STEPS: OnboardingStep[] = [
	{
		id: 'welcome',
		icon: Zap,
		title: 'Welcome to Vectreal!',
		description:
			"You're now part of the beta. This short walkthrough covers the four core steps of the platform so you can test the complete flow.",
		detail:
			'Each step links to the exact feature — use the QA checklist to verify everything works as expected. You can skip any step at any time.',
		qa: [
			'Sign-up and sign-in flows work correctly',
			'Dashboard loads your account data',
			'Navigation is intuitive and accessible'
		]
	},
	{
		id: 'upload',
		icon: Upload,
		title: 'Upload a 3D Model',
		description:
			'Open the Publisher and drag-and-drop a 3D file (GLB, glTF, OBJ, USDZ) onto the canvas. The model should appear in the viewer immediately.',
		detail:
			'Try files from different formats and verify the loading indicator, error handling for unsupported types, and that the model renders correctly.',
		qa: [
			'File picker and drag-and-drop both work',
			'Supported formats load without errors',
			'Unsupported files show a clear error message',
			'Loading indicator appears while parsing'
		],
		cta: {
			label: 'Open Publisher',
			to: '/publisher'
		}
	},
	{
		id: 'optimize',
		icon: Zap,
		title: 'Optimize & Configure',
		description:
			"Use the publisher sidebar to adjust quality settings, lighting, and camera position. Save the scene to your account when you're happy with the result.",
		detail:
			'Verify that quality presets apply visibly, environment and stage settings update the viewport in real time, and saving works correctly.',
		qa: [
			'Quality presets (raw → low) produce visible changes',
			'Environment and lighting controls update in real time',
			'Camera controls respond correctly',
			'Scene save prompts sign-in for unauthenticated users'
		],
		cta: {
			label: 'Open Publisher',
			to: '/publisher'
		}
	},
	{
		id: 'manage',
		icon: FolderOpen,
		title: 'Manage in Dashboard',
		description:
			'Navigate to the Dashboard to see your saved scenes and projects. Verify the overview KPIs, scene list, and project organisation all reflect your data.',
		detail:
			'Check that scenes appear after saving in the publisher, that the dashboard KPIs are accurate, and that project/folder navigation works end-to-end.',
		qa: [
			'Saved scenes appear in the dashboard scene list',
			'KPIs (total projects, scenes, published/draft) are correct',
			'Scene thumbnail updates after a publish',
			'Project and folder navigation works without errors'
		],
		cta: {
			label: 'Go to Dashboard',
			to: '/dashboard'
		}
	},
	{
		id: 'publish',
		icon: Code2,
		title: 'Publish & Embed',
		description:
			'Open a scene from the dashboard, publish it, then copy the generated embed snippet. Paste it into any HTML page to verify the embedded viewer loads.',
		detail:
			'Confirm the embed URL is publicly accessible only when a preview API key is provided, draft scenes return 404 for external access, and the responsive iframe renders correctly.',
		qa: [
			'Publish action transitions scene status from draft → published',
			'Embed snippet is generated and copyable',
			'Embed requires a valid preview API key for external access',
			'Draft scenes return 404 when accessed externally',
			'Embedded iframe renders the published model'
		],
		cta: {
			label: 'Go to Dashboard',
			to: '/dashboard'
		}
	},
	{
		id: 'done',
		icon: Rocket,
		title: "You're All Set!",
		description:
			"You've completed the beta walkthrough. Head to the dashboard to start creating, or read the docs for deeper platform knowledge.",
		detail:
			'Found a bug or have feedback? Drop it in our Discord or open a GitHub issue — every report helps.',
		cta: {
			label: 'Go to Dashboard',
			to: '/dashboard'
		}
	}
]

const OnboardingPage = () => {
	const [currentStep, setCurrentStep] = useState(0)
	const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

	const step = STEPS[currentStep]
	const isFirst = currentStep === 0
	const isLast = currentStep === STEPS.length - 1
	const progress = Math.round((currentStep / (STEPS.length - 1)) * 100)

	const handleNext = () => {
		setCompletedSteps((prev) => new Set(prev).add(currentStep))
		if (!isLast) {
			setCurrentStep((prev) => prev + 1)
		}
	}

	const handleBack = () => {
		if (!isFirst) setCurrentStep((prev) => prev - 1)
	}

	const StepIcon = step.icon

	return (
		<div className="from-background to-background/95 flex min-h-screen flex-col bg-gradient-to-br via-transparent">
			{/* Header */}
			<header className="flex items-center justify-between p-6">
				<Link to="/" aria-label="Home">
					<VectrealLogoAnimated className="text-muted-foreground h-6" colored />
				</Link>
				<Link to="/dashboard">
					<Button variant="ghost" size="sm" className="text-muted-foreground">
						Skip onboarding
					</Button>
				</Link>
			</header>

			{/* Step progress */}
			<div className="mx-auto w-full max-w-2xl px-6">
				<div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
					<span>
						Step {currentStep + 1} of {STEPS.length}
					</span>
					<span>{progress}%</span>
				</div>
				<Progress value={progress} className="h-1.5" />

				{/* Step pills */}
				<ol className="mt-4 flex items-center gap-1" aria-label="Onboarding steps">
					{STEPS.map((s, i) => (
						<li key={s.id} className="flex-1">
							<button
								onClick={() => setCurrentStep(i)}
								className={cn(
									'h-1.5 w-full rounded-full transition-colors',
									i < currentStep || completedSteps.has(i)
										? 'bg-accent'
										: i === currentStep
											? 'bg-accent/60'
											: 'bg-muted'
								)}
								aria-label={`Go to step: ${s.title}`}
								aria-current={i === currentStep ? ('step' as const) : undefined}
							/>
						</li>
					))}
				</ol>
			</div>

			{/* Main content */}
			<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
				<div className="bg-card/50 border-border/50 rounded-3xl border p-8 shadow-2xl backdrop-blur-sm">
					{/* Icon */}
					<div
						className={cn(
							'mb-6 flex h-14 w-14 items-center justify-center rounded-2xl',
							isLast
								? 'bg-accent/20 text-accent'
								: 'bg-muted/50 text-muted-foreground'
						)}
					>
						<StepIcon className="h-7 w-7" />
					</div>

					{/* Content */}
					<h1 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
						{step.title}
					</h1>
					<p className="text-muted-foreground mb-4 text-base leading-relaxed">
						{step.description}
					</p>
					<p className="text-muted-foreground/70 mb-6 text-sm leading-relaxed">
						{step.detail}
					</p>

					{/* QA checklist */}
					{step.qa && step.qa.length > 0 && (
						<div className="bg-muted/30 border-border/40 mb-6 rounded-xl border p-4">
							<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
								QA Checklist
							</p>
							<ul className="space-y-2">
								{step.qa.map((item) => (
									<li key={item} className="flex items-start gap-2 text-sm">
										<Check className="text-accent mt-0.5 h-4 w-4 shrink-0" />
										<span className="text-muted-foreground">{item}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* CTA link */}
					{step.cta && (
						<div className="mb-6">
							{step.cta.external ? (
								<Button variant="outline" size="sm" asChild>
									<a
										href={step.cta.to}
										target="_blank"
										rel="noreferrer"
										className="gap-2"
									>
										{step.cta.label}
										<ExternalLink className="h-3.5 w-3.5" />
									</a>
								</Button>
							) : (
								<Button variant="outline" size="sm" asChild>
									<Link to={step.cta.to} className="gap-2">
										{step.cta.label}
										<ExternalLink className="h-3.5 w-3.5" />
									</Link>
								</Button>
							)}
						</div>
					)}

					{/* Navigation */}
					<div className="flex items-center justify-between gap-4">
						<Button
							variant="ghost"
							onClick={handleBack}
							disabled={isFirst}
							className="min-w-20"
						>
							Back
						</Button>

						{isLast ? (
							<Button asChild className="bg-accent hover:bg-accent/90 gap-2">
								<Link to="/dashboard">
									Go to Dashboard
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
						) : (
							<Button onClick={handleNext} className="gap-2">
								Next
								<ArrowRight className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>

				{/* Docs link */}
				<p className="text-muted-foreground/60 mt-6 text-center text-sm">
					Want to go deeper?{' '}
					<Link
						to="/docs"
						className="text-accent/80 hover:text-accent underline underline-offset-4"
					>
						Read the documentation
					</Link>
				</p>
			</main>
		</div>
	)
}

export default OnboardingPage
