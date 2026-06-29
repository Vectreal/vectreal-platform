import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import { fadeUp, staggerContainer } from '@shared/components/motion'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router'

import HeroScene from './hero-scene'

interface CinematicHeroProps {
	isMobile: boolean
}

export function CinematicHero({ isMobile }: CinematicHeroProps) {
	const prefersReducedMotion = useReducedMotion()

	return (
		<section
			className="relative flex h-[100dvh] min-h-[640px] w-full items-center overflow-hidden"
			aria-label="Hero"
		>
			{/* Full-bleed 3D background (desktop only) */}
			{!isMobile && (
				<div className="absolute inset-0 z-0">
					<HeroScene />
				</div>
			)}

			{/* Base + legibility gradient */}
			<div
				className={cn(
					'absolute inset-0 z-0',
					isMobile
						? 'bg-surface-0'
						: 'bg-linear-to-r from-background via-background/85 to-transparent'
				)}
				aria-hidden="true"
			/>

			{/* Bottom vignette into the page */}
			<div
				className="from-background absolute right-0 bottom-0 left-0 z-0 h-48 bg-linear-to-t to-transparent"
				aria-hidden="true"
			/>

			{/* Ambient grid texture */}
			<div
				className="absolute inset-0 z-0 opacity-[0.07]"
				style={{
					backgroundImage:
						'linear-gradient(var(--surface-border) 1px, transparent 1px), linear-gradient(90deg, var(--surface-border) 1px, transparent 1px)',
					backgroundSize: '64px 64px',
					maskImage:
						'radial-gradient(ellipse 100% 80% at 30% 40%, black, transparent 75%)'
				}}
				aria-hidden="true"
			/>

			{/* Content layer — left-aligned on every breakpoint for consistency */}
			<motion.div
				variants={prefersReducedMotion ? undefined : staggerContainer}
				initial={prefersReducedMotion ? undefined : 'hidden'}
				animate="visible"
				className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start gap-7 px-6"
			>
				{/* Label chip */}
				<motion.div
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="bg-surface-1/70 border-surface-border inline-flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm"
				>
					<span
						className="bg-accent h-1.5 w-1.5 rounded-full"
						aria-hidden="true"
					/>
					<span
						className="text-muted-foreground font-medium"
						style={{
							fontSize: 'var(--text-label-xs)',
							letterSpacing: '0.12em'
						}}
					>
						3D PUBLISHING PLATFORM
					</span>
				</motion.div>

				{/* Headline — light weight, tight tracking, accent focal word */}
				<motion.h1
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="text-foreground max-w-[16ch] font-medium text-balance"
					style={{
						fontSize: 'clamp(2.75rem, 6.5vw, 5.5rem)',
						letterSpacing: '-0.035em',
						lineHeight: 1.02
					}}
				>
					Upload. Prepare.{' '}
					<span className="text-accent">Publish.</span>
				</motion.h1>

				{/* Subheadline */}
				<motion.p
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="text-muted-foreground max-w-[46ch] text-lg text-pretty md:text-xl"
				>
					The all-in-one platform for preparing, managing, and publishing 3D
					models for the web.
				</motion.p>

				{/* CTAs */}
				<motion.div
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="flex flex-col gap-3 sm:flex-row sm:items-center"
				>
					<Button
						asChild
						size="lg"
						className="group bg-accent hover:bg-accent/90 rounded-xl px-7 text-white"
					>
						<Link to="/publisher">
							Publish Your First Model
							<ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
					</Button>
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

			{/* Scroll cue */}
			<motion.div
				initial={prefersReducedMotion ? undefined : { opacity: 0 }}
				animate={prefersReducedMotion ? undefined : { opacity: 1 }}
				transition={{ delay: 1.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
				className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
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
