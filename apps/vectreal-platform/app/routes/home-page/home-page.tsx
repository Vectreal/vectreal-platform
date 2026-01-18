import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { Button } from '@shared/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Globe, Sparkle, Wrench } from 'lucide-react'
import { Link, redirect } from 'react-router'

import screenshotPublisher from '../../assets/images/publisher-optimize-2181px.webp'
import {
	BasicCard,
	Footer,
	GridBg,
	Navigation,
	Section
} from '../../components'
import {
	FiletypeCarousel,
	HeroParallaxBg,
	HeroScene,
	MockShopSection
} from '../../components'
import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import { Route } from './+types/home-page'
export async function loader({ request }: Route.LoaderArgs) {
	/**
	 * Determine if the request comes from a mobile client by the headers in the request
	 */
	const defaultResponse = {
		isMobile: isMobileRequest(request),
		user: null
	}

	try {
		const { client, headers } = await createSupabaseClient(request)

		const {
			data: { session }
		} = await client.auth.getSession()

		if (!session) return defaultResponse

		const {
			data: { user }
		} = await client.auth.getUser()

		// Create a new URL object to parse the request URL
		const url = new URL(request.url)
		const isRootPage = url.pathname === '/'

		// If the user is authenticated and trying to access the root page, redirect to the dashboard
		// This makes the dashboard the landing page for authenticated users
		if (user && isRootPage) {
			return redirect('/dashboard', { headers })
		} else {
			return { user, isMobile: isMobileRequest(request) }
		}
	} catch (error) {
		console.error('Error during loader authentication check:', error)
	}

	return defaultResponse
}

const HomePage = ({ loaderData }: Route.ComponentProps) => {
	const isMobile = useIsMobile(loaderData.isMobile)
	const user: User | null =
		loaderData && 'user' in loaderData ? loaderData.user : null

	return (
		<>
			<Navigation user={user} />

			<main>
				<section
					className={cn(
						'relative mx-auto flex overflow-hidden xl:max-w-7xl',
						isMobile ? 'max-md:flex-col-reverse' : 'pl-8'
					)}
				>
					{/* Stars background */}
					<HeroParallaxBg />
					{/* Raidal gradient over the whole image from bottom left to top right in the accent color */}
					<div className="from-accent/20 to-accent/0 absolute inset-0 -z-5 bg-radial-[at_bottom_left]" />
					{/* side to side vignette gradient */}
					<div className="from-background to-background absolute inset-0 -z-5 bg-gradient-to-r via-transparent" />

					<div
						className={cn(
							'flex w-full flex-col gap-4 py-16 pb-20',
							isMobile && '-mt-32 w-[unset] px-6'
						)}
					>
						<h1 className="from-primary to-primary/50 bg-gradient-to-br bg-clip-text text-3xl leading-[.9] font-black text-transparent uppercase sm:text-4xl md:text-6xl lg:text-9xl">
							<div>Upload</div>
							<div>Prepare</div>
							<div>Publish</div>
						</h1>

						<div className="z-10 flex flex-col items-start justify-center">
							<p className="text-foreground/90 mt-4 text-lg mix-blend-difference md:text-xl">
								Vectreal is{' '}
								<strong className="text-foreground font-medium">
									your all-in-one platform
								</strong>{' '}
								for preparing, managing, and publishing 3D models for the web
							</p>
							<p className="text-foreground/90 mt-4 text-lg mix-blend-difference md:text-xl">
								Turn Your Creations Into Experiences today
							</p>

							<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
								<Link to="/publisher">
									<Button
										size="lg"
										className="group bg-accent transition-all hover:scale-[1.02] hover:animate-pulse"
									>
										<Sparkle className="mr-2 h-5 w-5 transition-all group-hover:rotate-12" />
										Publish Your First Model
									</Button>
								</Link>
								<Link
									to="https://github.com/vectreal/vectreal-platform"
									target="_blank"
									rel="noreferrer"
								>
									<Button
										variant="outline"
										size="lg"
										className="hover:bg-background/50 border-accent/20 transition-all"
									>
										<GithubLogo className="mr-2 h-5 w-5" />
										Start Contributing
									</Button>
								</Link>
							</div>
						</div>
					</div>

					<HeroScene vertical={isMobile} />
				</section>

				{/* gradient border effect */}
				<div className="from-background via-muted-foreground/50 to-background h-[1px] w-full bg-gradient-to-r" />

				{/* Additional information chip covering the fold */}
				<div className="-mt-6 h-12">
					<AnimatePresence>
						<motion.div
							layout="size"
							initial={{ opacity: 0, height: 0 }}
							animate={{
								opacity: 1,
								height: 'auto',
								transition: { delay: 0.5 }
							}}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.5 }}
							className="bg-background/20 mx-auto flex w-fit max-w-3xl justify-center gap-4 space-x-4 overflow-clip rounded-full border border-white/10 px-4 shadow-md backdrop-blur-lg"
						>
							{(isMobile
								? [
										{
											icon: Check,
											text: 'Try Vectreal Free'
										}
									]
								: [
										{ icon: Check, text: 'No registration' },
										{ icon: Check, text: 'Instant publishing' },
										{ icon: Check, text: 'Simple drag & drop' },
										{ icon: Check, text: 'Share immediately' }
									]
							).map((item, i) => (
								<div
									key={i}
									className="text-foreground/90 inline-flex items-center gap-2 py-3 text-sm"
								>
									<item.icon className="text-primary h-4 w-4" />
									<span>{item.text}</span>
									{i < 3 && (
										<span className="text-foreground/30 ml-1 hidden sm:inline">
											•
										</span>
									)}
								</div>
							))}
						</motion.div>
					</AnimatePresence>
				</div>

				<Section className="relative my-8 h-128 w-full overflow-hidden" fadeIn>
					<GridBg isMobile={isMobile} />
					<div className="z-10 flex flex-col gap-4 text-center">
						<p className="text-foreground/90 mt-4 text-lg md:text-xl">
							Whether you're testing concepts or powering an online store
						</p>
						<h3>
							Vectreal gives you{' '}
							<span className="text-accent">everything you need</span> to get
							from file to frame.
						</h3>
					</div>
				</Section>

				<Section className="mt-16" fadeIn>
					<div className="flex flex-col gap-8">
						<div className="w-full">
							<h2>How It Works</h2>
							<p className="text-foreground/90 mt-4 text-lg md:text-xl">
								Effortless from Start to Finish
							</p>
						</div>

						<div className="w-full">
							<ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
								<li className="grow">
									<BasicCard highlight className="h-full">
										<CardHeader>
											<CardTitle className="text-4xl font-light">
												0<span className="text-accent pl-1 font-bold">1</span>
											</CardTitle>
											<p className="text-foreground/90 mt-4 text-lg md:text-xl">
												Upload
											</p>
										</CardHeader>
										<CardContent>
											<p>
												Just drag & drop your model — glTF, FBX, OBJ, STL and
												more.
											</p>
											<p>Our system gets to work instantly.</p>
										</CardContent>
									</BasicCard>
								</li>
								<li className="grow">
									<BasicCard highlight className="h-full">
										<CardHeader>
											<CardTitle className="text-4xl font-light">
												0<span className="text-accent pl-1 font-bold">2</span>
											</CardTitle>
											<p className="text-foreground/90 mt-4 text-lg md:text-xl">
												Optimize & Customize
											</p>
										</CardHeader>
										<CardContent>
											<p>
												Choose quality settings from raw to low, tweak lighting,
												and refine camera angles—all in an immersive editor.
											</p>
										</CardContent>
									</BasicCard>
								</li>

								<li className="grow">
									<BasicCard highlight className="h-full">
										<CardHeader>
											<CardTitle className="text-4xl font-light">
												0<span className="text-accent pl-1 font-bold">3</span>
											</CardTitle>
											<p className="text-foreground/90 mt-4 text-lg md:text-xl">
												Manage
											</p>
										</CardHeader>
										<CardContent>
											<p>
												Secure cloud storage with versioning, asset
												organization, and instant previews.
											</p>
										</CardContent>
									</BasicCard>
								</li>
								<li className="grow">
									<BasicCard highlight className="h-full">
										<CardHeader>
											<CardTitle className="text-4xl font-light">
												0<span className="text-accent pl-1 font-bold">4</span>
											</CardTitle>
											<p className="text-foreground/90 mt-4 text-lg md:text-xl">
												Publish
											</p>
										</CardHeader>
										<CardContent>
											<p>
												Unlock a code snippet for direct embed into websites,
												portfolios, eCommerce, blogs—you name it.
											</p>
										</CardContent>
									</BasicCard>
								</li>
							</ol>
						</div>
					</div>
				</Section>

				<Section border fadeIn>
					<div className="mb-16 flex flex-col gap-8">
						<div className="flex flex-col gap-4 text-center">
							<h3 className="w-full text-center">
								Have a model? Dive in and show it off.
							</h3>
							<p className="text-foreground/90 mt-4 text-lg md:text-xl">
								From portfolios to interactive experiences, Vectreal gives your
								3D models the platform they deserve in under 2 minutes.
							</p>
						</div>

						<div className="flex flex-col gap-4 md:gap-6">
							<div className="flex flex-col-reverse justify-between gap-4 md:grid md:grid-rows-[auto_auto]">
								<div className="mx-auto h-full max-w-6xl grow overflow-hidden shadow-2xl">
									<img
										src={screenshotPublisher}
										alt="Screenshot of the Vectreal Publisher interface"
										className="h-full w-full overflow-clip object-contain"
									/>
								</div>
								<div className="flex flex-col justify-between gap-4 py-4 md:flex-row">
									<BasicCard>
										<CardHeader>
											<CardTitle className="text-xl font-medium">
												Artists & Designers
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p>
												Showcase work with customizable environments that make
												your models shine.
											</p>
										</CardContent>
									</BasicCard>
									<BasicCard>
										<CardHeader>
											<CardTitle className="text-xl font-medium">
												Developers
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p>
												Integrate 3D content with minimal code and maximum
												performance.
											</p>
										</CardContent>
									</BasicCard>
									<BasicCard>
										<CardHeader>
											<CardTitle className="text-xl font-medium">
												Businesses
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p>
												Transform catalogs with interactive 3D models that boost
												engagement.
											</p>
										</CardContent>
									</BasicCard>
								</div>
							</div>

							<div className="flex w-full justify-end gap-4 max-md:flex-col md:items-end">
								<p className="mb-2">
									Ready to transform your 3D content experience?
								</p>

								<Link to="/publisher">
									<Button>
										<Sparkle className="mr-2" />
										Launch Your First Model
									</Button>
								</Link>
							</div>
						</div>
					</div>
				</Section>

				<MockShopSection />

				<Section fadeIn>
					<div className="flex flex-col gap-8">
						<div className="w-full">
							<h2>3D Content Drives Customer Engagement</h2>
							<p className="text-foreground/90 mt-4 text-lg md:text-xl">
								Industry data proves interactive 3D models deliver measurable
								business results
							</p>
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							<BasicCard>
								<CardHeader>
									<CardTitle className="text-5xl font-bold">
										60<span className="text-accent font-light">%</span>
									</CardTitle>
								</CardHeader>
								<CardContent className="flex grow flex-col justify-between">
									<p className="mb-4">
										higher purchase intent when products are showcased with
										interactive 3D or AR experiences
									</p>
									<div className="text-muted-foreground/75 flex items-center text-sm">
										<span>AP News</span>
										<Link
											viewTransition
											to="https://apnews.com/press-release/globe-newswire/technology-business-lifestyle-79fe640885f900736beed0fe33f7d972"
											className="ml-auto"
											target="_blank"
											rel="noreferrer"
										>
											Read more →
										</Link>
									</div>
								</CardContent>
							</BasicCard>

							<BasicCard>
								<CardHeader>
									<CardTitle className="text-5xl font-bold">
										44<span className="text-accent font-light">%</span>
									</CardTitle>
								</CardHeader>
								<CardContent className="flex grow flex-col justify-between">
									<p className="mb-4">
										more products added to cart after customers engage with
										interactive 3D product visualizations
									</p>
									<div className="text-muted-foreground/75 flex items-center text-sm">
										<span>Shopify</span>
										<Link
											viewTransition
											to="https://www.shopify.com/ie/case-studies/rebecca-minkoff"
											className="ml-auto"
											target="_blank"
											rel="noreferrer"
										>
											Read more →
										</Link>
									</div>
								</CardContent>
							</BasicCard>

							<BasicCard>
								<CardHeader>
									<CardTitle className="text-5xl font-bold">
										94<span className="text-accent font-light">%</span>
									</CardTitle>
								</CardHeader>
								<CardContent className="flex grow flex-col justify-between">
									<p className="mb-4">
										increase in conversion rates for products enhanced with
										augmented reality features
									</p>
									<div className="text-muted-foreground/75 flex items-center text-sm">
										<span>Harvard Business Review</span>
										<Link
											viewTransition
											to="https://hbr.org/2020/10/how-ar-is-redefining-retail-in-the-pandemic"
											className="ml-auto"
											target="_blank"
											rel="noreferrer"
										>
											Read more →
										</Link>
									</div>
								</CardContent>
							</BasicCard>
						</div>
					</div>
				</Section>

				<Section fadeIn>
					<GridBg isMobile={isMobile} />
					<div className="z-10 flex flex-col gap-4 py-24">
						<div className="w-full">
							<h2>Ready When You Are</h2>
							<p className="text-foreground/90 mt-4 text-lg md:text-xl">
								Your 3D Vision Today - No barriers, no waiting
							</p>
						</div>
						<BasicCard>
							<CardContent className="flex w-full flex-col gap-4 md:flex-row">
								<ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
									<li className="flex items-center gap-2">
										<Check size={16} className="text-primary" /> No registration
									</li>
									<li className="flex items-center gap-2">
										<Check size={16} className="text-primary" /> Instant
										publishing
									</li>
									<li className="flex items-center gap-2">
										<Check size={16} className="text-primary" /> Simple drag &
										drop
									</li>
									<li className="flex items-center gap-2">
										<Check size={16} className="text-primary" /> Share
										immediately
									</li>
								</ul>
								<Link to="/publisher">
									<Button className="mt-2">
										<Sparkle className="mr-2" />
										Launch Your First Model
									</Button>
								</Link>
							</CardContent>
						</BasicCard>
					</div>
				</Section>

				<FiletypeCarousel />

				<Section fadeIn className="my-8 h-128 w-full overflow-hidden">
					<GridBg isMobile={isMobile} />
					<div className="z-10 flex flex-col gap-4">
						<div className="w-full">
							<h2>Resources & Learning</h2>
							<p className="text-foreground/90 mt-4 text-lg md:text-xl">
								Want to dive deeper?
							</p>
						</div>

						<BasicCard className="flex w-full flex-col gap-4">
							<CardContent>
								<p className="mb-4">
									We've got guides, best practices, case studies, and tutorials
									to help you go from beginner to pro.
								</p>
								<Button className="w-fit">Explore our Knowledge Hub</Button>
							</CardContent>
						</BasicCard>
					</div>
				</Section>

				<Section border fadeIn>
					<div className="flex flex-col gap-4">
						<span>
							<h2>Powered by Community</h2>
							<p className="text-foreground/90 mt-4 text-lg md:text-xl">
								Vectreal is built by and for the 3D community.
							</p>
						</span>

						<ul className="flex flex-col justify-between gap-4 md:flex-row">
							<li className="w-full grow flex-col">
								<BasicCard className="h-full">
									<CardContent>
										<Check className="mt-1 inline" size={32} />
										<p className="text-foreground/90 mt-4 text-lg md:text-xl">
											100% open-source
										</p>
									</CardContent>
								</BasicCard>
							</li>
							<li className="w-full grow flex-col">
								<BasicCard className="h-full">
									<CardContent>
										<Wrench className="mt-1 inline" size={32} />
										<p className="text-foreground/90 mt-4 text-lg md:text-xl">
											Built by developers, artists, and dreamers
										</p>
									</CardContent>
								</BasicCard>
							</li>
							<li className="w-full grow flex-col">
								<BasicCard className="h-full">
									<CardContent>
										<Globe className="mt-1 inline" size={32} />
										<p className="text-foreground/90 mt-4 text-lg md:text-xl">
											Global contributors, shared knowledge, real collaboration
										</p>
									</CardContent>
								</BasicCard>
							</li>
						</ul>

						<p className="text-foreground/90 mt-4 text-lg md:text-xl">
							Join the community that’s reimagining how 3D lives on the web.
						</p>
						<Button className="mt-2 w-fit px-8!">
							<GithubLogo /> Meet the Community
						</Button>
					</div>
				</Section>
			</main>

			<Footer />
		</>
	)
}

export default HomePage
