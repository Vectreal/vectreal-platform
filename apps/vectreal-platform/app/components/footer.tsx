import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Link } from 'react-router'

export const SlimFooter = () => {
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
			</div>
		</footer>
	)
}

export const Footer = () => {
	return (
		<footer className="border-border/50 bg-background w-full border-t px-6 pb-8 inset-shadow-[0rem_1rem_2rem_-1rem] inset-shadow-black/50 backdrop-blur-sm">
			<div className="mx-auto flex max-w-7xl flex-col gap-16 py-32">
				<div className="space-y-8">
					<Link to="/" className="inline-block">
						<VectrealLogoAnimated className="text-foreground h-8 w-auto" />
					</Link>
					<p className="text-muted-foreground max-w-2xl text-lg">
						Vectreal is the ultimate 3D visualization platform, empowering
						developers to create stunning, interactive 3D experiences with ease.
					</p>
				</div>

				<div className="grid grid-cols-2 flex-col justify-center gap-16 text-left text-sm md:grid-cols-4 md:flex-row md:gap-6">
					<div>
						<h3 className="text-foreground mb-4 text-lg font-semibold">
							Product
						</h3>
						<ul className="flex flex-col gap-4">
							<li className="text-foreground list-item">
								<Link to="/viewer-library">Viewer Library</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/react-hooks-library">React Hooks Library</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/core-library">Core Library</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/features">Features</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/pricing">Pricing</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/docs">Documentation</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/release-notes">Release Notes</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="text-foreground mb-4 text-lg font-semibold">
							Company
						</h3>
						<ul className="flex flex-col gap-4">
							<li className="text-foreground list-item">
								<Link to="/about">About Us</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/careers">Careers</Link>
							</li>
							<li className="text-foreground list-item">
								<Link to="/blog">Blog</Link>
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
								<Link to="/">Youtube</Link>
							</li>
						</ul>
					</div>
				</div>
			</div>
			<small className="text-muted-foreground/70 mx-auto block text-center text-sm">
				© {new Date().getFullYear()} Vectreal. All rights reserved.
			</small>
		</footer>
	)
}
