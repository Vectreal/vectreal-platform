import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import {
	Code,
	Globe,
	Rocket,
	Upload,
	Wrench,
	Zap
} from 'lucide-react'
import { Link } from 'react-router'

import { Route } from './+types/home-page'
import { CinematicHero } from '../../components/home/cinematic-hero'
import FiletypeCarousel from '../../components/home/filetype-carousel'
import {
	BentoCard,
	GradientCtaBlock,
	OptimizationVisual,
	ScrollytellViewerSection,
	SocialProofBar,
	StatRing,
	StepFlow
} from '../../components/landing'
import Section from '../../components/layout-components/section'
import { SUPPORTED_FORMAT_NAMES } from '../../constants/product-copy'
import { buildPageMeta } from '../../lib/seo'
import {
	buildOrganizationJsonLd,
	PUBLIC_SEO_PAGES
} from '../../lib/seo-registry'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

export async function loader({ request }: Route.LoaderArgs) {
	const isMobile = isMobileRequest(request)
	return { isMobile }
}

export function meta(_: Route.MetaArgs) {
	return buildPageMeta(PUBLIC_SEO_PAGES.home, undefined, {
		structuredData: buildOrganizationJsonLd()
	})
}

const SOCIAL_PROOF_ITEMS = [
	{ text: '60% higher purchase intent with 3D' },
	{ text: '44% more add-to-cart with interactive models' },
	{ text: '94% conversion lift with AR' },
	{ text: '100% open-source' },
	{ text: 'No registration required' },
	{ text: 'Instant publishing' }
]

const HOW_IT_WORKS_STEPS = [
	{
		number: '01',
		title: 'Upload',
		body: `Just drag & drop your model — ${SUPPORTED_FORMAT_NAMES.join(', ')} supported. Our system gets to work instantly.`
	},
	{
		number: '02',
		title: 'Optimize & Customize',
		body: 'Choose quality settings, tweak lighting, and refine camera angles in an immersive editor.'
	},
	{
		number: '03',
		title: 'Manage',
		body: 'Secure cloud storage with versioning, asset organization, and instant previews.'
	},
	{
		number: '04',
		title: 'Publish',
		body: 'Unlock an embed snippet for direct integration into websites, portfolios, eCommerce, and blogs.'
	}
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

const SectionLabel = ({
	children,
	className
}: {
	children: React.ReactNode
	className?: string
}) => (
	<div
		className={cn(
			'border-accent/20 bg-accent/5 text-accent/70 text-eyebrow inline-flex w-fit items-center gap-1.5 self-start rounded-full border px-3 py-1.5',
			className
		)}
	>
		<span className="bg-accent/60 h-1.5 w-1.5 rounded-full" aria-hidden="true" />
		{children}
	</div>
)

const SectionHeading = ({
	label,
	title,
	subtitle,
	align = 'left'
}: {
	label: string
	title: string
	subtitle?: string
	align?: 'left' | 'center'
}) => (
	<div
		className={cn(
			'flex flex-col gap-4',
			align === 'center' && 'items-center text-center'
		)}
	>
		<SectionLabel>{label}</SectionLabel>
		<h2 className="text-h2 text-foreground">{title}</h2>
		{subtitle && (
			<p className="text-muted-foreground text-body-lg max-w-xl">{subtitle}</p>
		)}
	</div>
)

const HomePage = () => {
	return (
		<main className="bg-background">
			{/* 1. Cinematic hero */}
			<CinematicHero />

			{/* 2. Social proof bar */}
			<SocialProofBar items={SOCIAL_PROOF_ITEMS} />

			{/* 3. Scrollytell product demo */}
			<ScrollytellViewerSection />

			{/* 4. How it works */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-12">
					<SectionHeading
						label="Process"
						title="How It Works"
						subtitle="Effortless from start to finish."
					/>
					<StepFlow steps={HOW_IT_WORKS_STEPS} />
				</div>
			</Section>

			{/* 5. Optimization value prop */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-12">
					<SectionHeading
						label="Optimization"
						title="Ship lighter, load faster"
						subtitle="Drop a heavy production asset and get a web-ready model in seconds — automatically."
					/>
					<OptimizationVisual />
				</div>
			</Section>

			{/* 6. Stats */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-12">
					<SectionHeading
						label="Results"
						title="3D Content Drives Results"
						subtitle="Industry data proves interactive 3D models deliver measurable business outcomes."
					/>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
						<StatRing
							value={60}
							label="higher purchase intent when products are showcased with interactive 3D or AR"
							source="AP News"
							sourceUrl="https://apnews.com/press-release/globe-newswire/technology-business-lifestyle-79fe640885f900736beed0fe33f7d972"
						/>
						<StatRing
							value={44}
							label="more products added to cart after customers engage with interactive 3D"
							source="Shopify"
							sourceUrl="https://www.shopify.com/ie/case-studies/rebecca-minkoff"
						/>
						<StatRing
							value={94}
							label="increase in conversion rates for products enhanced with augmented reality"
							source="Harvard Business Review"
							sourceUrl="https://hbr.org/2020/10/how-ar-is-redefining-retail-in-the-pandemic"
						/>
					</div>
				</div>
			</Section>

			{/* 6. Feature bento grid */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-12">
					<SectionHeading
						label="Platform"
						title="Everything You Need"
						subtitle="One platform, zero friction."
					/>

					<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{BENTO_FEATURES.map((feature) => (
							<BentoCard
								key={feature.title}
								as="li"
								tilt={feature.tilt}
								glow={feature.glow}
							>
								<div className="border-surface-border bg-surface-0/60 group-hover:border-accent/40 group-hover:bg-accent/5 flex size-11 items-center justify-center rounded-xl border transition-colors duration-300">
									<feature.icon
										className="text-accent size-5 transition-transform duration-300 group-hover:scale-110"
										aria-hidden="true"
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<p className="text-foreground font-medium">
										{feature.title}
									</p>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{feature.body}
									</p>
								</div>
							</BentoCard>
						))}
					</ul>
				</div>
			</Section>

			{/* 7. Format carousel */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-12">
					<SectionHeading
						label="Formats"
						title="Supports Every Major Format"
						subtitle="Bring your files as they are — we handle conversion and cloud integration."
					/>
					<FiletypeCarousel />
				</div>
			</Section>

			{/* 8. Community */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-8">
					<SectionHeading
						label="Community"
						title="Powered by Community"
						subtitle="Vectreal is built by and for the 3D community."
					/>

					<ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
						{COMMUNITY_ITEMS.map((item) => (
							<BentoCard key={item.text} as="li">
								<item.icon className="text-accent h-5 w-5" aria-hidden="true" />
								<p className="text-muted-foreground text-sm leading-relaxed">
									{item.text}
								</p>
							</BentoCard>
						))}
					</ul>

					<Button asChild className="mt-2 w-fit rounded-xl px-8">
						<Link to="https://github.com/vectreal" target="_blank" rel="noreferrer">
							<GithubLogo className="mr-2" />
							Meet the Community
						</Link>
					</Button>
				</div>
			</Section>

			{/* 9. FAQ */}
			<Section fadeIn className="my-24">
				<div className="flex flex-col gap-8">
					<SectionHeading
						label="FAQ"
						title="Frequently Asked Questions"
						subtitle="Quick answers for setup, uploads, and publishing."
					/>

					<BentoCard className="max-w-2xl">
						<Accordion type="single" collapsible className="w-full">
							<AccordionItem value="faq-account">
								<AccordionTrigger>
									Do I need an account to test Vectreal?
								</AccordionTrigger>
								<AccordionContent>
									No account is required to upload and test in Publisher. Create
									an account only when you want persistent management and
									publishing workflows.
								</AccordionContent>
							</AccordionItem>
							<AccordionItem value="faq-formats">
								<AccordionTrigger>
									Which 3D formats are supported?
								</AccordionTrigger>
								<AccordionContent>
									Supported formats: {SUPPORTED_FORMAT_NAMES.join(', ')}. For
									multi-file glTF uploads, include the full bundle (.gltf + .bin
									+ textures) to preserve all references.
								</AccordionContent>
							</AccordionItem>
							<AccordionItem value="faq-files">
								<AccordionTrigger>
									What happens to my files before publish?
								</AccordionTrigger>
								<AccordionContent>
									Files remain local while you test and optimize in the browser.
									Cloud storage and hosted sharing flows start only when you
									explicitly publish.
								</AccordionContent>
							</AccordionItem>
							<AccordionItem value="faq-embed">
								<AccordionTrigger>
									Can I embed scenes in my own site?
								</AccordionTrigger>
								<AccordionContent>
									Yes. Once published, you can generate embed snippets and
									configure domain/API constraints for controlled integration
									into product pages and apps.
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</BentoCard>
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
