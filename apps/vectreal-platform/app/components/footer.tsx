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
				<span>© {new Date().getFullYear()} Vectreal. All rights reserved.</span>
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
						<div className="space-y-4">
							<h3 className="text-foreground text-lg font-semibold">
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
							</ul>
						</div>
					</div>
				</div>
				<div className="relative flex w-full items-center justify-end p-4 max-sm:flex-col">
					<div className="flex grow items-center gap-4">
						<Link
							to="https://www.producthunt.com/products/vectreal?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-vectreal-platform"
							aria-label="Vectreal Platform on Product Hunt"
						>
							<img
								src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1119194&theme=dark&t=1776193236739"
								alt="Vectreal Platform - Open-source 3D web visualization and publishing | Product Hunt"
								width={200}
								height={43}
							/>
						</Link>

						<div className="flex flex-wrap gap-3">
							<Link
								to="https://github.com/vectreal/"
								aria-label="GitHub"
								className="text-foreground/70 hover:text-foreground transition-colors"
							>
								<svg
									viewBox="0 0 24 24"
									className="h-5 w-5"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
								</svg>
							</Link>
							<Link
								to="https://discord.gg/A9a3nPkZw7"
								aria-label="Discord"
								className="text-foreground/70 hover:text-foreground transition-colors"
							>
								<svg
									viewBox="0 0 24 24"
									className="h-5 w-5"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.06.1 18.07.11 18.07a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
								</svg>
							</Link>
							<Link
								to="https://reddit.com/r/vectreal/"
								aria-label="Reddit"
								className="text-foreground/70 hover:text-foreground transition-colors"
							>
								<svg
									viewBox="0 0 24 24"
									className="h-5 w-5"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
								</svg>
							</Link>
							<Link
								to="https://youtube.com/vectreal/"
								aria-label="YouTube"
								className="text-foreground/70 hover:text-foreground transition-colors"
							>
								<svg
									viewBox="0 0 24 24"
									className="h-5 w-5"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
								</svg>
							</Link>
							<Link
								to="https://x.com/vectreal"
								aria-label="X (Twitter)"
								className="text-foreground/70 hover:text-foreground transition-colors"
							>
								<svg
									viewBox="0 0 24 24"
									className="h-5 w-5"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
								</svg>
							</Link>
						</div>
					</div>

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
					<div className="from-background absolute bottom-0 h-48 w-full bg-linear-to-b to-transparent sm:h-64 md:h-96 xl:h-128" />
					<VectrealLogoAnimated
						animated={false}
						className="text-muted-foreground fixed bottom-0 -z-10 h-fit w-full"
					/>
				</div>
			)}
		</>
	)
}
