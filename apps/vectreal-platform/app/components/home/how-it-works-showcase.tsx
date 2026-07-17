import { cn } from '@shared/utils'
import {
	AnimatePresence,
	motion,
	useInView,
	useReducedMotion
} from 'framer-motion'
import {
	Check,
	Cloud,
	Code2,
	Database,
	FileBox,
	type LucideIcon,
	PauseIcon,
	Share2,
	SlidersHorizontal,
	Upload
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Step {
	index: number
	title: string
	icon: LucideIcon
	body: string
}

const STEPS: Step[] = [
	{
		index: 0,
		title: 'Upload',
		icon: Upload,
		body: 'Drag & drop your model — GLB, glTF, USDZ, USDA. Processing starts instantly.'
	},
	{
		index: 1,
		title: 'Optimize',
		icon: SlidersHorizontal,
		body: 'Automatic mesh decimation, texture compression, and Draco encoding.'
	},
	{
		index: 2,
		title: 'Manage',
		icon: Database,
		body: 'Versioned cloud storage, asset organization, and instant previews.'
	},
	{
		index: 3,
		title: 'Publish',
		icon: Share2,
		body: 'Generate an embed snippet and drop your scene into any site.'
	}
] as const

const STEP_DURATION = 4200

const easeOut = [0.16, 1, 0.3, 1] as const
const stageTransition = { duration: 0.5, ease: easeOut }

// ---------------------------------------------------------------------------
// Per-step graphics
// ---------------------------------------------------------------------------

const FORMAT_CHIPS = [
	{ label: '.GLB', x: '-128%', y: '-70%', delay: 0.5 },
	{ label: '.GLTF', x: '128%', y: '-40%', delay: 0.65 },
	{ label: '.USDZ', x: '-120%', y: '75%', delay: 0.8 },
	{ label: '.OBJ', x: '125%', y: '70%', delay: 0.95 }
]

function UploadGraphic() {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-7">
			<div className="border-surface-border relative flex h-48 w-full max-w-md items-center justify-center rounded-2xl border border-dashed">
				{/* Floating format chips */}
				{FORMAT_CHIPS.map((chip) => (
					<motion.span
						key={chip.label}
						className="bg-surface-2/80 border-surface-border text-muted-foreground absolute rounded-lg border px-2.5 py-1 font-mono text-[11px] backdrop-blur-sm"
						style={{ left: '50%', top: '50%' }}
						initial={{ opacity: 0, x: '-50%', y: '-50%', scale: 0.6 }}
						animate={{
							opacity: 1,
							x: `calc(-50% + ${chip.x})`,
							y: `calc(-50% + ${chip.y})`,
							scale: 1
						}}
						transition={{ delay: chip.delay, ...stageTransition }}
					>
						{chip.label}
					</motion.span>
				))}
				<motion.div
					initial={{ y: -64, opacity: 0, rotate: -8 }}
					animate={{ y: 0, opacity: 1, rotate: 0 }}
					transition={{ type: 'spring', stiffness: 220, damping: 16 }}
					className="bg-surface-2 border-surface-border flex size-20 items-center justify-center rounded-2xl border shadow-2xl"
				>
					<FileBox className="text-accent size-9" />
				</motion.div>
			</div>
			<div className="w-full max-w-md">
				<div className="text-muted-foreground mb-2 flex justify-between text-xs">
					<span>rocket-v3.glb</span>
					<motion.span
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 1.6 }}
						className="text-accent"
					>
						uploaded
					</motion.span>
				</div>
				<div className="bg-surface-2 h-2 w-full overflow-hidden rounded-full">
					<motion.div
						className="bg-accent h-full rounded-full"
						initial={{ width: '0%' }}
						animate={{ width: '100%' }}
						transition={{ duration: 1.4, ease: easeOut, delay: 0.3 }}
					/>
				</div>
			</div>
		</div>
	)
}

function OptimizeGraphic() {
	const tasks = ['Mesh decimation', 'Texture compression', 'Draco encoding']
	return (
		<div className="mx-auto flex h-full w-full max-w-md flex-col justify-center gap-3">
			{tasks.map((task, i) => (
				<motion.div
					key={task}
					className="bg-surface-2/60 border-surface-border flex items-center justify-between rounded-xl border px-4 py-3"
					initial={{ opacity: 0, x: -16 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.15 + i * 0.25, ...stageTransition }}
				>
					<span className="text-foreground text-sm">{task}</span>
					<motion.span
						className="bg-accent flex size-6 items-center justify-center rounded-full text-white"
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{
							delay: 0.6 + i * 0.4,
							type: 'spring',
							stiffness: 400,
							damping: 16
						}}
					>
						<Check className="size-3.5" />
					</motion.span>
				</motion.div>
			))}
			<motion.div
				className="mt-1 flex items-baseline justify-center gap-2"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 1.9, ...stageTransition }}
			>
				<span className="text-muted-foreground text-sm line-through">
					124 MB
				</span>
				<span className="text-accent text-lg font-medium">→ 3.2 MB</span>
			</motion.div>
		</div>
	)
}

function ManageGraphic() {
	const versions = ['v3 · current', 'v2', 'v1']
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-4">
			<motion.div
				className="border-surface-border bg-surface-2/60 flex items-center gap-2 rounded-full border px-4 py-2"
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={stageTransition}
			>
				<Cloud className="text-accent size-4" />
				<span className="text-muted-foreground text-xs">Synced to cloud</span>
			</motion.div>
			<div className="flex w-full max-w-sm flex-col gap-2">
				{versions.map((v, i) => (
					<motion.div
						key={v}
						className={cn(
							'border-surface-border flex items-center justify-between rounded-xl border px-4 py-3',
							i === 0 ? 'border-accent/30' : 'bg-surface-2/40'
						)}
						initial={{ opacity: 0, y: 14, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ delay: 0.2 + i * 0.18, ...stageTransition }}
					>
						<span
							className={cn(
								'text-sm',
								i === 0 ? 'text-foreground' : 'text-muted-foreground'
							)}
						>
							{v}
						</span>
						{i === 0 && <span className="bg-accent size-1.5 rounded-full" />}
					</motion.div>
				))}
			</div>
		</div>
	)
}

function PublishGraphic() {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-5">
			<div className="bg-surface-2/60 border-surface-border w-full max-w-md overflow-hidden rounded-xl border">
				<div className="border-surface-border flex items-center gap-2 border-b px-3 py-2">
					<Code2 className="text-muted-foreground size-3.5" />
					<span className="text-muted-foreground/70 text-[11px]">embed</span>
				</div>
				<motion.div
					className="overflow-hidden p-3 font-mono text-[11px] whitespace-nowrap"
					initial={{ width: 0 }}
					animate={{ width: '100%' }}
					transition={{ duration: 1.3, ease: 'linear', delay: 0.3 }}
				>
					<span className="text-foreground">{'<iframe src='}</span>
					<span className="text-accent">{'"vectreal.com/…"'}</span>
					<span className="text-foreground">{' />'}</span>
				</motion.div>
			</div>
			<motion.div
				className="border-accent/30 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ delay: 1.7, type: 'spring', stiffness: 300, damping: 18 }}
			>
				<span className="relative flex size-2">
					<span className="bg-accent absolute inline-flex size-full animate-ping rounded-full opacity-60" />
					<span className="bg-accent relative inline-flex size-2 rounded-full" />
				</span>
				<span className="text-xs font-medium text-white">Live</span>
			</motion.div>
		</div>
	)
}

const GRAPHICS = [UploadGraphic, OptimizeGraphic, ManageGraphic, PublishGraphic]

// ---------------------------------------------------------------------------

export function HowItWorksShowcase({ className }: { className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { amount: 0.4, margin: '0px 0px -10% 0px' })
	const prefersReducedMotion = useReducedMotion()
	const [active, setActive] = useState(0)
	const [paused, setPaused] = useState(false)
	const [hoveredItem, setHoveredItem] = useState<Step | null>()
	const progressRef = useRef(0)
	const progressBarRef = useRef<HTMLSpanElement>(null)

	const running = inView && !paused && !prefersReducedMotion

	function handleItemClick(index: number) {
		setPaused(true)
		progressRef.current = 0
		setActive(index)
	}

	// Reset progress whenever the active step changes. Written straight to the
	// DOM (not React state) since this bar's width would otherwise need a
	// state update on every step change; kept consistent with the rAF loop
	// below, which also writes directly to the DOM.
	useEffect(() => {
		progressRef.current = 0
		if (progressBarRef.current) progressBarRef.current.style.width = '0%'
	}, [active])

	// rAF-driven progress: delta-based (immune to tab throttling), holds on
	// pause/offscreen, advances the step when it completes. No setTimeout drift.
	// Writes the bar width directly to the DOM instead of through React state —
	// a per-frame setState here would re-render this whole subtree 60x/sec,
	// saturating the main thread and starving iOS Safari's touch-scroll /
	// CSS scroll-snap handling for other sections on the page.
	useEffect(() => {
		if (!running) return
		let raf = 0
		let last = performance.now()
		const tick = (now: number) => {
			const dt = Math.min(now - last, 100) // clamp jumps after tab background
			last = now
			progressRef.current = Math.min(
				progressRef.current + dt / STEP_DURATION,
				1
			)
			if (progressBarRef.current) {
				progressBarRef.current.style.width = `${progressRef.current * 100}%`
			}
			if (progressRef.current >= 1) {
				setActive((a) => (a + 1) % STEPS.length)
				return
			}
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [running, active])

	const ActiveGraphic = GRAPHICS[active]

	return (
		<div
			ref={ref}
			onMouseLeave={() => setPaused(false)}
			className={cn(
				'flex flex-col items-center gap-6 lg:flex-row lg:gap-8',
				className
			)}
		>
			{/* Step list */}
			<ul className="flex shrink-0 flex-col gap-2.5">
				{STEPS.map((step, i) => {
					const isActive = i === active
					return (
						<li
							key={step.index}
							onMouseEnter={() => setHoveredItem(step)}
							onMouseLeave={() => setHoveredItem(null)}
						>
							<button
								type="button"
								onClick={() => handleItemClick(i)}
								className={cn(
									'group relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-300',
									isActive
										? 'border-accent/30 bg-surface-2'
										: 'border-surface-border bg-surface-1 hover:bg-surface-1/80'
								)}
							>
								{/* Active progress bar — width written directly to the DOM by the rAF loop, not React state */}
								{isActive && !prefersReducedMotion && (
									<span
										ref={progressBarRef}
										className="bg-accent/70 absolute bottom-0 left-0 h-0.5"
										style={{ width: '0%' }}
									/>
								)}
								<span
									className={cn(
										'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300',
										isActive
											? 'border-accent/40 bg-accent bg-opacity-10'
											: 'border-surface-border bg-surface-0/60'
									)}
								>
									<AnimatePresence mode="wait">
										{!paused && hoveredItem?.index === i ? (
											<motion.span
												key={'pause' + i}
												// key={
												// 	i +
												// 	(hoveredItem?.index === i
												// 		? String(hoveredItem?.index)
												// 		: '')
												// }
												initial={{
													scale: 0.5,
													opacity: 0
												}}
												animate={{
													scale: 1,
													opacity: 1,
													transition: { delay: 0.25 }
												}}
												exit={{
													scale: 0.95,
													opacity: 0,
													transition: { duration: 0.25 }
												}}
											>
												<PauseIcon />
											</motion.span>
										) : (
											<motion.span
												key={'icon' + i}
												initial={{
													scale: 0.95,
													opacity: 0
												}}
												animate={{
													scale: 1,
													opacity: 1
												}}
												exit={{
													scale: 1.5,
													opacity: 0,
													transition: { duration: 0.1 }
												}}
											>
												<step.icon
													className={cn(
														'size-5 transition-colors duration-300',
														isActive ? 'text-accent' : 'text-muted-foreground'
													)}
												/>
											</motion.span>
										)}
									</AnimatePresence>
								</span>
								<div className="flex flex-col gap-0.5">
									<div className="flex items-center gap-2">
										<span
											className={cn(
												'text-xs font-medium tabular-nums transition-colors',
												isActive ? 'text-accent' : 'text-muted-foreground/50'
											)}
										>
											0{String(step.index + 1)}
										</span>
										<span
											className={cn(
												'font-medium transition-colors',
												isActive ? 'text-foreground' : 'text-muted-foreground'
											)}
										>
											{step.title}
										</span>
									</div>
									<p className="text-muted-foreground/80 text-sm leading-relaxed">
										{step.body}
									</p>
								</div>
							</button>
						</li>
					)
				})}
			</ul>

			{/* Animated stage */}
			<div className="bg-surface-1 border-surface-border lg:w-unset relative h-[340px] w-full overflow-hidden rounded-2xl border md:h-[400px]">
				{/* dot-grid texture */}
				<div
					className="pointer-events-none absolute inset-0 opacity-[0.5]"
					style={{
						backgroundImage:
							'radial-gradient(var(--surface-border) 1px, transparent 1px)',
						backgroundSize: '22px 22px',
						maskImage:
							'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent 75%)',
						WebkitMaskImage:
							'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent 75%)'
					}}
					aria-hidden="true"
				/>
				{/* ambient bloom */}
				<div
					className="pointer-events-none absolute -top-1/4 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[90px]"
					style={{
						background:
							'radial-gradient(circle, var(--surface-glow) 0%, transparent 70%)'
					}}
					aria-hidden="true"
				/>
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={
							prefersReducedMotion ? undefined : { opacity: 0, scale: 1.02 }
						}
						transition={stageTransition}
						className="absolute inset-0 p-8"
					>
						<ActiveGraphic />
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}
