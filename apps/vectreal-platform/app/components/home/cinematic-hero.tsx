import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import { fadeUp, staggerContainer } from '@shared/components/motion'
import { Button } from '@shared/components/ui/button'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router'

import HeroScene from './hero-scene'
import { AuroraBackground } from '../landing/aurora-background'
import { Magnetic } from '../landing/magnetic'

export function CinematicHero() {
	const prefersReducedMotion = useReducedMotion()

	return (
		<section
			className="relative flex min-h-[100dvh] w-full items-center overflow-hidden pt-24 pb-12 lg:pt-0 lg:pb-0"
			aria-label="Hero"
		>
			<AuroraBackground />

			{/* Bottom vignette into the page */}
			<div
				className="from-background pointer-events-none absolute right-0 bottom-0 left-0 z-0 h-40 bg-linear-to-t to-transparent"
				aria-hidden="true"
			/>

			<div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-6 lg:grid-cols-2 lg:gap-4">
				{/* Text column */}
				<motion.div
					variants={prefersReducedMotion ? undefined : staggerContainer}
					initial={prefersReducedMotion ? undefined : 'hidden'}
					animate="visible"
					className="flex flex-col items-start gap-7 lg:pr-8"
				>
					<motion.div
						variants={prefersReducedMotion ? undefined : fadeUp}
						className="bg-surface-1/70 border-surface-border inline-flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm"
					>
						<span
							className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full"
							aria-hidden="true"
						/>
						<span className="text-eyebrow text-muted-foreground">
							3D Publishing Platform
						</span>
					</motion.div>

					<motion.h1
						variants={prefersReducedMotion ? undefined : fadeUp}
						className="text-display text-foreground max-w-[15ch]"
					>
						Upload. Prepare. <span className="text-accent">Publish.</span>
					</motion.h1>

					<motion.p
						variants={prefersReducedMotion ? undefined : fadeUp}
						className="text-body-lg text-muted-foreground max-w-[46ch]"
					>
						The all-in-one platform for preparing, managing, and publishing 3D
						models for the web — no plugins, no friction.
					</motion.p>

					<motion.div
						variants={prefersReducedMotion ? undefined : fadeUp}
						className="flex flex-col gap-3 sm:flex-row sm:items-center"
					>
						<Magnetic>
							<Button
								asChild
								size="lg"
								className="group bg-accent hover:bg-accent/90 rounded-xl px-7 text-white shadow-[0_8px_30px_-8px_var(--surface-glow)]"
							>
								<Link to="/publisher">
									Publish Your First Model
									<ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
								</Link>
							</Button>
						</Magnetic>
						<Button
							asChild
							size="lg"
							variant="ghost"
							className="text-muted-foreground hover:text-foreground rounded-xl px-5"
						>
							<Link
								to="https://github.com/vectreal/vectreal-platform"
								target="_blank"
								rel="noreferrer"
							>
								<GithubLogo className="mr-1 size-4" />
								View on GitHub
							</Link>
						</Button>
					</motion.div>
				</motion.div>

				{/* 3D column */}
				<motion.div
					initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
					animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
					transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
					className="relative h-[42vh] w-full sm:h-[50vh] lg:h-[88vh]"
				>
					{/* Glow disc behind the model */}
					<div
						className="absolute top-1/2 left-1/2 -z-10 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
						style={{
							background:
								'radial-gradient(circle, var(--surface-glow) 0%, transparent 70%)'
						}}
						aria-hidden="true"
					/>
					<HeroScene vertical />
				</motion.div>
			</div>

			{/* Scroll cue */}
			<motion.div
				initial={prefersReducedMotion ? undefined : { opacity: 0 }}
				animate={prefersReducedMotion ? undefined : { opacity: 1 }}
				transition={{ delay: 1.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
				className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 lg:block"
				aria-hidden="true"
			>
				<motion.div
					animate={prefersReducedMotion ? undefined : { y: [0, 6, 0] }}
					transition={
						prefersReducedMotion
							? undefined
							: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
					}
				>
					<ChevronDown className="text-muted-foreground/40 size-5" />
				</motion.div>
			</motion.div>
		</section>
	)
}
