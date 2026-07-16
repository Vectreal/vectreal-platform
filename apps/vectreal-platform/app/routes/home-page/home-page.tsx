import { useIsMobile } from '@shared/components'
import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import { Code, Globe, Rocket, Upload, Wrench, Zap } from 'lucide-react'
import { Link } from 'react-router'

import { Route } from './+types/home-page'
import { GridBg } from '../../components'
import {
	BentoCard,
	CinematicHero,
	FiletypeCarousel,
	GradientCtaBlock,
	HowItWorksShowcase,
	OptimizationGridBg,
	OptimizationVisual,
	SocialProofBar,
	StatRing
} from '../../components/home'
import { SectionHeader, Section } from '../../components/home/section'
import { SUPPORTED_FORMAT_NAMES } from '../../constants/product-copy'
import { buildPageMeta } from '../../lib/seo'
import {
	buildOrganizationJsonLd,
	PUBLIC_SEO_PAGES
} from '../../lib/seo-registry'
import { identifyMobileRequest } from '../../lib/utils/identify-mobile-request'

export async function loader({ request }: Route.LoaderArgs) {
	const isMobile = identifyMobileRequest(request)
	return { isMobile }
}

export function meta(_: Route.MetaArgs) {
	return buildPageMeta(PUBLIC_SEO_PAGES.home, undefined, {
		structuredData: buildOrganizationJsonLd()
	})
}

const SOCIAL_PROOF_ITEMS = [
	// { text: '60% higher purchase intent with 3D' },
	// { text: '44% more add-to-cart with interactive models' },
	// { text: '94% conversion lift with AR' },
	{ text: '100% open-source' },
	{ text: 'No registration required' },
	{ text: 'Instant publishing' }
]

const BENTO_FEATURES: Array<{
	icon: React.ComponentType<{ className?: string }>
	title: string
	body: string
	tilt: boolean
	glow: boolean
}> = [
	{
		icon: Upload,
		title: 'Simple Drag & Drop',
		body: `Every major 3D format supported: ${SUPPORTED_FORMAT_NAMES.join(', ')}.`,
		tilt: true,
		glow: true
	},
	{
		icon: Rocket,
		title: 'Instant Publishing',
		body: 'From drag & drop to a live shareable URL in under two minutes.',
		tilt: true,
		glow: false
	},
	{
		icon: Zap,
		title: 'No Registration',
		body: 'Upload and test instantly — no account required until you want persistent publishing.',
		tilt: true,
		glow: false
	},
	{
		icon: Globe,
		title: 'Web-Native 3D',
		body: 'Optimized for the browser. Fast loads, clean renders, zero plugins.',
		tilt: true,
		glow: false
	},
	{
		icon: Code,
		title: 'Embed Anywhere',
		body: 'A single snippet drops your scene into any site — with domain and API constraints.',
		tilt: true,
		glow: false
	},
	{
		icon: GithubLogo,
		title: '100% Open Source',
		body: 'Built in the open. Contribute, fork, self-host — your call.',
		tilt: true,
		glow: false
	}
]

const COMMUNITY_ITEMS: Array<{
	icon: React.ComponentType<{ className?: string }>
	text: string
}> = [
	{
		icon: Wrench,
		text: 'Built by developers, artists, and dreamers'
	},
	{
		icon: Globe,
		text: 'Global contributors, shared knowledge, real collaboration'
	},
	{
		icon: GithubLogo,
		text: '100% open-source — fork it, extend it, own it'
	}
]

const FAQ_ITEMS: { value: string; q: string; a: string }[] = [
	{
		value: 'faq-account',
		q: 'Do I need an account to test Vectreal?',
		a: 'No account is required to upload and test in Publisher. Create an account only when you want persistent management and publishing workflows.'
	},
	{
		value: 'faq-formats',
		q: 'Which 3D formats are supported?',
		a: `Supported formats: ${SUPPORTED_FORMAT_NAMES.join(', ')}. For multi-file glTF uploads, include the full bundle (.gltf + .bin + textures) to preserve all references.`
	},
	{
		value: 'faq-files',
		q: 'What happens to my files before publish?',
		a: 'Files remain local while you test and optimize in the browser. Cloud storage and hosted sharing flows start only when you explicitly publish.'
	},
	{
		value: 'faq-embed',
		q: 'Can I embed scenes in my own site?',
		a: 'Yes. Once published, you can generate embed snippets and configure domain/API constraints for controlled integration into product pages and apps.'
	}
]
const HomePage = ({ loaderData }: Route.ComponentProps) => {
	const isMobile = useIsMobile(loaderData.isMobile)

	return (
		<main className="bg-background overflow-x-clip">
			{/* 1. Cinematic hero */}
			<CinematicHero />

			{/* 2. Social proof bar */}
			<SocialProofBar items={SOCIAL_PROOF_ITEMS} />

			{/* 3. Scrollytell product demo */}
			{/* <ScrollytellViewerSection isMobileViewport={isMobile} /> */}

			{/* 4. How it works */}
			<Section aria-label="How it works">
				<div className="relative z-10 flex flex-col gap-12 md:gap-16">
					<SectionHeader
						label="Process"
						title="How It Works"
						subtitle="Effortless from start to finish."
					/>
					<HowItWorksShowcase />
				</div>

				<GridBg isMobile={isMobile} />
			</Section>

			{/* 5. Optimization value prop */}
			<Section aria-label="Optimization" glow="right">
				<div className="relative z-10 flex flex-col gap-12 md:gap-16">
					<SectionHeader
						label="Optimization"
						title="Ship lighter, load faster"
						subtitle="Drop a heavy production asset and get a web-ready model in seconds — automatically."
					/>
					<OptimizationVisual />
				</div>

				<OptimizationGridBg />
			</Section>

			{/* 6. Stats */}
			<Section aria-label="Results" glow="left">
				<div className="flex flex-col gap-12 md:gap-16">
					<SectionHeader
						label="Results"
						title="3D Content Drives Results"
						subtitle="Industry data proves interactive 3D models deliver measurable business outcomes."
					/>
					<div className="no-scrollbar -mx-6 flex snap-x snap-proximity gap-6 overflow-x-auto px-6 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
						<StatRing
							className="w-[78%] shrink-0 snap-center sm:w-[55%] md:w-auto md:shrink"
							value={60}
							delay={0}
							label="higher purchase intent when products are showcased with interactive 3D or AR"
							source="AP News"
							sourceUrl="https://apnews.com/press-release/globe-newswire/technology-business-lifestyle-79fe640885f900736beed0fe33f7d972"
						/>
						<StatRing
							className="w-[78%] shrink-0 snap-center sm:w-[55%] md:w-auto md:shrink"
							value={44}
							delay={0.7}
							label="more products added to cart after customers engage with interactive 3D"
							source="Shopify"
							sourceUrl="https://www.shopify.com/ie/case-studies/rebecca-minkoff"
						/>
						<StatRing
							className="w-[78%] shrink-0 snap-center sm:w-[55%] md:w-auto md:shrink"
							value={94}
							delay={1.4}
							label="increase in conversion rates for products enhanced with augmented reality"
							source="Harvard Business Review"
							sourceUrl="https://hbr.org/2020/10/how-ar-is-redefining-retail-in-the-pandemic"
						/>
					</div>
				</div>
			</Section>

			{/* 6. Feature bento grid */}
			<Section>
				<div className="relative z-10 flex flex-col gap-12 md:gap-16">
					<SectionHeader
						label="Platform"
						title="Everything You Need"
						subtitle="One platform, zero friction."
					/>

					<ul className="no-scrollbar -mx-6 flex snap-x snap-proximity gap-6 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
						{BENTO_FEATURES.map((feature) => (
							<BentoCard
								key={feature.title}
								as="li"
								tilt={feature.tilt}
								glow={feature.glow}
								className="w-[78%] shrink-0 snap-center sm:w-auto sm:shrink"
							>
								<div className="border-surface-border bg-surface-0/60 group-hover:border-accent/40 group-hover:bg-accent/5 flex size-11 items-center justify-center rounded-xl border transition-colors duration-300">
									<feature.icon
										className="text-accent size-5 transition-transform duration-300 group-hover:scale-110"
										aria-hidden="true"
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<p className="text-foreground font-medium">{feature.title}</p>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{feature.body}
									</p>
								</div>
							</BentoCard>
						))}
					</ul>
				</div>

				<GridBg isMobile={isMobile} />
			</Section>

			{/* 7. Format carousel */}
			<Section>
				<div className="flex flex-col gap-12 md:gap-16">
					<SectionHeader
						label="Formats"
						title="Supports Every Major Format"
						subtitle="Bring your files as they are — we handle conversion and cloud integration."
					/>
					<FiletypeCarousel />
				</div>
			</Section>

			{/* 8. Community */}
			<Section aria-label="Community">
				<div className="relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
					{/* Left: copy + CTAs */}
					<div className="flex flex-col gap-6">
						<SectionHeader
							label="Community"
							title="Built in the open"
							subtitle="Vectreal is 100% open-source — built by and for the 3D community. Fork it, extend it, ship it."
						/>
						<ul className="flex flex-col gap-3">
							{COMMUNITY_ITEMS.map((item) => (
								<li key={item.text} className="flex items-center gap-3">
									<span className="border-surface-border bg-surface-1 flex size-9 shrink-0 items-center justify-center rounded-lg border">
										<item.icon
											className="text-accent size-4"
											aria-hidden="true"
										/>
									</span>
									<span className="text-muted-foreground text-sm">
										{item.text}
									</span>
								</li>
							))}
						</ul>
						<div className="mt-1 flex flex-col gap-3 sm:flex-row">
							<Button asChild className="rounded-xl px-6">
								<Link
									to="https://github.com/vectreal"
									target="_blank"
									rel="noreferrer"
								>
									<GithubLogo className="mr-2 size-4" />
									Star on GitHub
								</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="border-surface-border rounded-xl px-6"
							>
								<Link
									to="https://discord.gg/A9a3nPkZw7"
									target="_blank"
									rel="noreferrer"
								>
									Join the Discord
								</Link>
							</Button>
						</div>
					</div>

					{/* Right: real install + usage code visual */}
					<div className="bg-surface-1 border-surface-border overflow-hidden rounded-2xl border shadow-xl">
						<div className="border-surface-border flex items-center gap-2 border-b px-4 py-3">
							<span className="size-3 rounded-full bg-[#ff5f57]" />
							<span className="size-3 rounded-full bg-[#febc2e]" />
							<span className="size-3 rounded-full bg-[#28c840]" />
							<span className="text-muted-foreground/60 ml-2 text-xs">
								your-app.tsx
							</span>
						</div>
						<pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
							<code>
								<span className="text-muted-foreground/50">
									{'# Install the viewer\n'}
								</span>
								<span className="text-foreground">{'pnpm add '}</span>
								<span className="text-accent">{'@vctrl/viewer\n\n'}</span>
								<span className="text-muted-foreground/50">
									{'// Drop a model into any React app\n'}
								</span>
								<span className="text-[#7aa2f7]">{'import'}</span>
								<span className="text-foreground">
									{' { VectrealViewer } '}
								</span>
								<span className="text-[#7aa2f7]">{'from'}</span>
								<span className="text-accent">{" '@vctrl/viewer'\n\n"}</span>
								<span className="text-foreground">{'<'}</span>
								<span className="text-[#e0af68]">{'VectrealViewer'}</span>
								<span className="text-[#9ece6a]">{' src'}</span>
								<span className="text-foreground">{'='}</span>
								<span className="text-accent">{'{modelUrl}'}</span>
								<span className="text-foreground">{' />'}</span>
							</code>
						</pre>
					</div>
				</div>

				<GridBg isMobile={isMobile} />
			</Section>

			{/* 9. FAQ */}
			<Section aria-label="FAQ">
				<div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
					{/* Left: heading + aside */}
					<div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
						<SectionHeader
							label="FAQ"
							title="Frequently asked questions"
							subtitle="Quick answers for setup, uploads, and publishing."
						/>
						<div className="bg-surface-1 border-surface-border flex flex-col gap-2.5 rounded-2xl border p-5">
							<p className="text-foreground font-medium">
								Still have questions?
							</p>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Reach the team directly or ask the community.
							</p>
							<div className="mt-1 flex flex-wrap gap-3">
								<Link
									to="/contact"
									className="text-accent hover:text-accent/80 text-sm font-medium underline-offset-4 hover:underline"
								>
									Contact us
								</Link>
								<span className="text-muted-foreground/40" aria-hidden="true">
									·
								</span>
								<Link
									to="https://discord.gg/A9a3nPkZw7"
									target="_blank"
									rel="noreferrer"
									className="text-accent hover:text-accent/80 text-sm font-medium underline-offset-4 hover:underline"
								>
									Ask on Discord
								</Link>
							</div>
						</div>
					</div>

					{/* Right: accordion */}
					<div className="bg-surface-1 border-surface-border overflow-hidden rounded-2xl border">
						<Accordion type="single" collapsible className="w-full">
							{FAQ_ITEMS.map((item) => (
								<AccordionItem
									key={item.value}
									value={item.value}
									className="border-surface-border border-b bg-transparent! px-5 last:border-b-0"
								>
									<AccordionTrigger className="text-foreground py-5 text-left text-[0.95rem] hover:no-underline">
										{item.q}
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground pb-5 text-sm leading-relaxed">
										{item.a}
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</div>
			</Section>

			{/* 10. CTA block */}
			<GradientCtaBlock
				headline="Start Publishing Today"
				subtext="No account needed. Drag, optimize, publish — in under 2 minutes."
				primaryCta={{ label: 'Publish Your First Model', to: '/publisher' }}
				secondaryCta={{ label: 'Explore the Docs', to: '/docs' }}
			/>
		</main>
	)
}

export default HomePage
