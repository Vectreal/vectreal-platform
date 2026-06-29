import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import { fadeUp, staggerContainer } from '@shared/components/motion'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, Sparkle } from 'lucide-react'
import { Link } from 'react-router'

import HeroScene from './hero-scene'

const HERO_WORDS = ['Upload.', 'Prepare.', 'Publish.']

interface CinematicHeroProps {
	isMobile: boolean
}

export function CinematicHero({ isMobile }: CinematicHeroProps) {
	const prefersReducedMotion = useReducedMotion()

	return (
		<section
			className="relative flex h-[100dvh] w-full items-center overflow-hidden"
			aria-label="Hero"
		>
			{/* Full-bleed 3D background (desktop only) */}
			{!isMobile && (
				<div className="absolute inset-0 z-0">
					<HeroScene />
				</div>
			)}

			{/* Dark background for mobile or as base */}
			<div
				className={cn(
					'absolute inset-0 z-0',
					isMobile
						? 'bg-surface-0'
						: 'bg-linear-to-r from-surface-0 via-surface-0/80 to-transparent'
				)}
				aria-hidden="true"
			/>

			{/* Bottom vignette */}
			<div
				className="from-background absolute bottom-0 left-0 right-0 z-0 h-40 bg-linear-to-t to-transparent"
				aria-hidden="true"
			/>

			{/* Subtle grid on mobile */}
			{isMobile && (
				<div
					className="border-surface-border absolute inset-0 z-0 opacity-20"
					style={{
						backgroundImage:
							'linear-gradient(var(--surface-border) 1px, transparent 1px), linear-gradient(90deg, var(--surface-border) 1px, transparent 1px)',
						backgroundSize: '40px 40px'
					}}
					aria-hidden="true"
				/>
			)}

			{/* Content layer */}
			<motion.div
				variants={prefersReducedMotion ? undefined : staggerContainer}
				initial={prefersReducedMotion ? undefined : 'hidden'}
				animate="visible"
				className={cn(
					'relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-6',
					isMobile ? 'items-center text-center' : 'items-start'
				)}
			>
				{/* Label chip */}
				<motion.div
					variants={prefersReducedMotion ? undefined : fadeUp}
					className={cn(
						'bg-surface-1 border-surface-border inline-flex items-center gap-2 rounded-full border px-3 py-1.5'
					)}
				>
					<span
						className="bg-accent h-1.5 w-1.5 rounded-full"
						aria-hidden="true"
					/>
					<span
						className="text-muted-foreground font-medium"
						style={{
							fontSize: 'var(--text-label-xs)',
							letterSpacing: '0.1em'
						}}
					>
						3D PUBLISHING PLATFORM
					</span>
				</motion.div>

				{/* Headline — each word staggered */}
				<motion.h1
					variants={prefersReducedMotion ? undefined : staggerContainer}
					className="flex flex-col font-black leading-none"
					style={{
						fontSize: 'var(--text-display)',
						letterSpacing: 'var(--tracking-display)'
					}}
					aria-label={HERO_WORDS.join(' ')}
				>
					{HERO_WORDS.map((word) => (
						<motion.span
							key={word}
							variants={prefersReducedMotion ? undefined : fadeUp}
							className="from-foreground to-foreground/30 bg-linear-to-b bg-clip-text text-transparent"
						>
							{word}
						</motion.span>
					))}
				</motion.h1>

				{/* Subheadline */}
				<motion.p
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="text-muted-foreground max-w-[42ch] text-lg md:text-xl"
				>
					Your all-in-one platform for preparing, managing, and publishing 3D
					models for the web.
				</motion.p>

				{/* CTAs */}
				<motion.div
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="flex flex-col gap-3 sm:flex-row"
				>
					<Button
						asChild
						size="lg"
						className="bg-accent hover:bg-accent/90 rounded-xl px-8 font-semibold text-white"
					>
						<Link to="/publisher">
							<Sparkle className="mr-2 h-4 w-4" />
							Publish Your First Model
						</Link>
					</Button>
					<Button
						asChild
						size="lg"
						variant="outline"
						className="border-surface-border bg-surface-1/50 rounded-xl px-8 backdrop-blur-sm"
					>
						<Link
							to="https://github.com/vectreal/vectreal-platform"
							target="_blank"
							rel="noreferrer"
						>
							<GithubLogo className="mr-2 h-4 w-4" />
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
					animate={
						prefersReducedMotion ? undefined : { y: [0, 6, 0] }
					}
					transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
				>
					<ChevronDown className="text-muted-foreground/50 h-5 w-5" />
				</motion.div>
			</motion.div>
		</section>
	)
}
