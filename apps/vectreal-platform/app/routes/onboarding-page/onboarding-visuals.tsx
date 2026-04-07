/**
 * Visual panel components for each onboarding step.
 * Lazy-loads the R3F welcome scene so no Three.js code is imported server-side.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Code2, Upload, Zap } from 'lucide-react'
import {
	type ComponentType,
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState
} from 'react'

const OnboardingWelcomeScene = lazy(() => import('./onboarding-welcome-client'))

const GridBackground = () => (
	<div
		className="absolute inset-0 opacity-25"
		style={{
			backgroundImage:
				'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)',
			backgroundSize: '24px 24px'
		}}
	/>
)

const MockTrafficLights = () => (
	<div className="flex items-center gap-1.5">
		<div className="size-2 rounded-full bg-white/25" />
		<div className="size-2 rounded-full bg-white/20" />
		<div className="size-2 rounded-full bg-white/15" />
	</div>
)

interface SceneStatusBadgeProps {
	published: boolean
}

const SceneStatusBadge = ({ published }: SceneStatusBadgeProps) => (
	<motion.span
		layout
		className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
		animate={
			published
				? {
						backgroundColor: 'rgba(252,108,24,0.15)',
						color: '#fc6c18'
					}
				: {
						backgroundColor: 'rgba(255,255,255,0.06)',
						color: 'rgba(255,255,255,0.4)'
					}
		}
		transition={{ duration: 0.3 }}
	>
		{published ? 'Published' : 'Draft'}
	</motion.span>
)

const WindowShell = ({
	url,
	children
}: {
	url: string
	children: React.ReactNode
}) => (
	<motion.div
		className="relative h-[84%] min-h-[420px] w-[86%] max-w-[920px] overflow-hidden rounded-2xl border border-white/12 bg-black/45 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md"
		initial={{ opacity: 0, y: 12, scale: 0.985 }}
		animate={{ opacity: 1, y: 0, scale: 1 }}
		transition={{ duration: 0.45, ease: 'easeOut' }}
	>
		<div className="flex h-11 items-center gap-3 border-b border-white/10 bg-black/35 px-4">
			<MockTrafficLights />
			<div className="flex h-5 flex-1 items-center rounded-sm bg-white/8 px-2">
				<span className="truncate text-[10px] text-white/30">{url}</span>
			</div>
		</div>
		{children}
	</motion.div>
)

export const WelcomeVisual: ComponentType = () => {
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	return (
		<div className="relative h-full w-full overflow-hidden">
			<div className="pointer-events-none absolute inset-0 z-0">
				<div
					className="absolute top-6 -right-24 h-64 w-64 rounded-full"
					style={{
						background:
							'radial-gradient(circle, rgba(252,108,24,0.22), transparent 70%)',
						filter: 'blur(42px)'
					}}
				/>
				<div
					className="absolute bottom-8 -left-16 h-48 w-48 rounded-full"
					style={{
						background:
							'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
						filter: 'blur(36px)'
					}}
				/>
			</div>

			{mounted && (
				<Suspense fallback={null}>
					<OnboardingWelcomeScene />
				</Suspense>
			)}
		</div>
	)
}

export const UploadVisual: ComponentType = () => {
	const formats = ['GLB', 'glTF', 'OBJ', 'USDZ', 'FBX']

	return (
		<div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
			<GridBackground />
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						'radial-gradient(circle at 55% 45%, rgba(252,108,24,0.12) 0%, transparent 62%)'
				}}
			/>

			<WindowShell url="vectreal.com/publisher">
				<div className="relative flex h-[calc(100%-44px)] flex-col items-center justify-center gap-7 px-8 pb-8">
					<GridBackground />

					<motion.div
						className="relative z-10 flex w-[74%] max-w-[460px] flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-white/20 py-12"
						animate={{
							borderColor: [
								'rgba(255,255,255,0.16)',
								'rgba(252,108,24,0.55)',
								'rgba(255,255,255,0.16)'
							]
						}}
						transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
					>
						<motion.div
							animate={{ y: [-6, 6, -6] }}
							transition={{
								duration: 2.4,
								repeat: Infinity,
								ease: 'easeInOut'
							}}
							className="relative rounded-2xl bg-white/7 p-5"
						>
							<Upload className="size-9 text-white/55" />
							<div
								className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
								style={{
									background:
										'radial-gradient(circle, rgba(252,108,24,0.35) 0%, transparent 70%)',
									filter: 'blur(18px)'
								}}
							/>
						</motion.div>
						<div className="text-center">
							<p className="text-sm font-semibold text-white/75">
								Drop your 3D model here
							</p>
							<p className="mt-1 text-xs text-white/35">
								GLB, glTF, OBJ, USDZ, FBX
							</p>
						</div>
					</motion.div>

					<div className="z-10 flex flex-wrap justify-center gap-2">
						{formats.map((fmt) => (
							<span
								key={fmt}
								className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-white/45"
							>
								{fmt}
							</span>
						))}
					</div>
				</div>
			</WindowShell>
		</div>
	)
}

export const PublishVisual: ComponentType = () => {
	const [published, setPublished] = useState(false)
	const [quality, setQuality] = useState(35)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		const cycle = () => {
			setQuality(35)
			const step = 5
			let current = 35
			const sliderInterval = setInterval(() => {
				current += step
				setQuality(current)
				if (current >= 78) clearInterval(sliderInterval)
			}, 80)

			timeoutRef.current = setTimeout(() => setPublished(true), 2200)
			timeoutRef.current = setTimeout(() => {
				setPublished(false)
				setQuality(35)
				timeoutRef.current = setTimeout(cycle, 300)
			}, 2200 + 2000)
		}
		cycle()
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		}
	}, [])

	return (
		<div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
			<GridBackground />
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						'radial-gradient(circle at 72% 56%, rgba(252,108,24,0.14) 0%, transparent 60%)'
				}}
			/>

			<WindowShell url="vectreal.com/publisher/scene-id">
				<div className="flex h-[calc(100%-44px)] overflow-hidden">
					<div className="relative flex flex-1 items-center justify-center">
						<GridBackground />
						<motion.div
							className="relative z-10 size-28 rounded-3xl"
							style={{
								background:
									'linear-gradient(135deg, rgba(252,108,24,0.75), rgba(252,108,24,0.38))'
							}}
							animate={{ rotate: 360 }}
							transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
						/>
					</div>

					<div className="relative z-10 flex w-44 shrink-0 flex-col gap-4 border-l border-white/10 bg-black/20 px-4 py-4 backdrop-blur-sm">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-medium text-white/50">
								Quality
							</span>
							<span className="text-[10px] text-white/40 tabular-nums">
								{quality}%
							</span>
						</div>

						<div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
							<motion.div
								className="h-full rounded-full"
								animate={{ width: `${quality}%`, backgroundColor: '#fc6c18' }}
								transition={{ type: 'spring', stiffness: 80, damping: 20 }}
							/>
						</div>

						<div className="mt-auto flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<span className="text-[10px] text-white/40">Status</span>
								<SceneStatusBadge published={published} />
							</div>

							<AnimatePresence mode="wait">
								{!published ? (
									<motion.button
										key="publish-btn"
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold text-white"
										style={{ background: '#fc6c18' }}
									>
										<Zap className="size-2.5" />
										Publish
									</motion.button>
								) : (
									<motion.div
										key="published-state"
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										className="flex flex-col gap-1"
									>
										<div className="flex items-center gap-1 text-[10px] text-white/60">
											<CheckCircle2
												className="size-3 shrink-0"
												style={{ color: '#fc6c18' }}
											/>
											Live on CDN
										</div>
										<div
											className="truncate rounded-md px-2 py-1 text-[8px]"
											style={{
												background: 'rgba(252,108,24,0.08)',
												color: '#fc6c18',
												border: '1px solid rgba(252,108,24,0.2)'
											}}
										>
											cdn.vectreal.com/...
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>
				</div>
			</WindowShell>
		</div>
	)
}

export const DashboardVisual: ComponentType = () => {
	const scenes = [
		{ name: 'Rocket MK III', published: true },
		{ name: 'Product Shot B', published: false },
		{ name: 'Logo Reveal', published: true },
		{ name: 'Interior Walk', published: false },
		{ name: 'Chair 001', published: true },
		{ name: 'Helmet Pro', published: true }
	]

	return (
		<div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
			<GridBackground />
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						'radial-gradient(ellipse at 64% 0%, rgba(252,108,24,0.1) 0%, transparent 56%)'
				}}
			/>

			<WindowShell url="vectreal.com/dashboard">
				<div className="flex h-[calc(100%-44px)] flex-col gap-3 overflow-hidden px-4 py-4">
					<div className="grid grid-cols-3 gap-2.5">
						{scenes.map((scene, i) => (
							<motion.div
								key={scene.name}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: i * 0.08, duration: 0.35 }}
								className="flex flex-col gap-1.5 rounded-lg border border-white/8 bg-white/5 p-2.5"
							>
								<div
									className="h-14 rounded-md"
									style={{
										background: scene.published
											? 'linear-gradient(135deg, rgba(252,108,24,0.26), rgba(252,108,24,0.1))'
											: 'rgba(255,255,255,0.04)'
									}}
								/>
								<p className="truncate text-[9px] font-medium text-white/60">
									{scene.name}
								</p>
								<SceneStatusBadge published={scene.published} />
							</motion.div>
						))}
					</div>

					<div className="mt-auto rounded-lg border border-white/8 bg-white/3 p-3">
						<div className="mb-1.5 flex items-center gap-1.5">
							<Code2 className="size-3 text-white/30" />
							<span className="text-[9px] font-medium text-white/40">
								Embed snippet
							</span>
						</div>
						<div className="rounded-md bg-black/30 px-2 py-1.5 font-mono text-[8px] text-white/25">
							{'<iframe src="cdn.vectreal.com/..." />'}
						</div>
					</div>
				</div>
			</WindowShell>
		</div>
	)
}
