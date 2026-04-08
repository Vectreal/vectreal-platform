import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { cn } from '@shared/utils'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router'

import { useConsent } from './consent/consent-context'
import { ShimmerRotatingText } from './shimmer-rotating-text'

export const SlimFooter = () => {
	const { setPreferencesOpen } = useConsent()

	return (
		<footer className="border-border/50 bg-background/80 w-full border-t px-6 py-4 backdrop-blur-sm">
			<div className="text-foreground/70 mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 text-center text-sm md:flex-row md:gap-4">
				<span>
					© {new Date().getFullYear()} Vectreal. All rights reserved.
				</span>
				<span>·</span>
				<Link to="/privacy-policy">Privacy Policy</Link>
				<span>·</span>
				<Link to="/terms-of-service">Terms of Service</Link>
				<span>·</span>
				<button
					type="button"
					className="hover:text-foreground transition-colors"
					onClick={() => setPreferencesOpen(true)}
				>
					Cookie Preferences
				</button>
			</div>
		</footer>
	)
}

export const Footer = () => {
	const { pathname } = useLocation()
	const { setPreferencesOpen } = useConsent()
	const isHomePage = pathname === '/' || pathname === '/home'

	const whispers = [
		'latency low. fidelity high.',
		'optimize once, ship everywhere.',
		'clean meshes. predictable renders.',
		'profiles first, polish second.',
		'build pipelines, not bottlenecks.'
	]

	return (
		<>
			<footer
				className={cn(
					'border-border/50 bg-background w-full overflow-hidden border-t border-b px-6 pb-8 backdrop-blur-sm',
					isHomePage ? 'mb-48 sm:mb-64 md:mb-96 xl:mb-128' : ''
				)}
			>
				<div className="mx-auto flex max-w-7xl flex-col gap-16 py-32">
					<div className="grid grid-cols-2 flex-col justify-center gap-16 text-left text-sm md:grid-cols-3 md:flex-row md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
						<div>
							<h3 className="text-foreground mb-4 text-lg font-semibold">
								Product
							</h3>
							<ul className="flex flex-col gap-4">
								<li className="text-foreground list-item">
									<Link to="/publisher">Publisher</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/dashboard">Dashboard</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/home">Home</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="https://github.com/Vectreal/vectreal-platform/releases">
										Release Notes
									</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/changelog">Changelog</Link>
								</li>
							</ul>
						</div>
						<div>
							<h3 className="text-foreground mb-4 text-lg font-semibold">
								Documentation
							</h3>
							<ul className="flex flex-col gap-4">
								<li className="text-foreground list-item">
									<Link to="/docs">Docs Home</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/docs/getting-started">Getting Started</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/docs/guides/upload">Guides</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/docs/packages/viewer">Package Reference</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/docs/contributing">Contributing</Link>
								</li>
							</ul>
						</div>
						<div>
							<h3 className="text-foreground mb-4 text-lg font-semibold">
								Company
							</h3>
							<ul className="flex flex-col gap-4">
								<li className="text-foreground list-item">
									<Link to="/home">Home</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/about">About Us</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/news-room">News Room</Link>
								</li>
							</ul>
						</div>
						<div>
							<h3 className="text-foreground mb-4 text-lg font-semibold">
								Legal
							</h3>
							<ul className="flex flex-col gap-4">
								<li className="text-foreground list-item">
									<Link to="/privacy-policy">Privacy Policy</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/code-of-conduct">Code of Conduct</Link>
								</li>
								<li className="text-foreground list-item">
									<button
										type="button"
										className="hover:text-foreground transition-colors"
										onClick={() => setPreferencesOpen(true)}
									>
										Cookie Preferences
									</button>
								</li>
								<li className="text-foreground list-item">
									<Link to="/terms-of-service">Terms of Service</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/contact">Contact Us</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="/imprint">Imprint</Link>
								</li>
							</ul>
						</div>
						<div>
							<h3 className="text-foreground mb-4 text-lg font-semibold">
								Community
							</h3>
							<ul className="flex flex-col gap-4">
								<li className="text-foreground list-item">
									<Link to="https://github.com/vectreal/">GitHub</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="https://discord.gg/A9a3nPkZw7">Discord</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="https://reddit.com/r/vectreal/">Reddit</Link>
								</li>
								<li className="text-foreground list-item">
									<Link to="https://youtube.com/vectreal/">Youtube</Link>
								</li>
							</ul>
						</div>
					</div>
				</div>
				<div className="relative flex w-full items-center justify-end p-4 max-sm:flex-col">
					<ShimmerRotatingText
						phrases={whispers}
						className="text-muted-foreground/80 hover:text-foreground/95 focus-visible:ring-ring/60 relative isolate overflow-hidden rounded-full border border-transparent px-4 py-1.5 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none"
						ariaLabel="cycle footer note"
					/>
					<motion.small className="text-muted-foreground/70 block text-center text-sm">
						© {new Date().getFullYear()} Vectreal. All rights reserved.
					</motion.small>
				</div>
			</footer>
			{isHomePage && (
				<div className="relative w-full">
					<div className="from-background absolute bottom-0 h-48 w-full bg-gradient-to-b to-transparent sm:h-64 md:h-96 xl:h-128" />
					<VectrealLogoAnimated
						animated={false}
						className="text-muted-foreground fixed bottom-0 -z-10 h-fit w-full"
					/>
				</div>
			)}
		</>
	)
}
