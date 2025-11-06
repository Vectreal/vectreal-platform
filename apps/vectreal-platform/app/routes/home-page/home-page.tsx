import { GithubLogo } from '@vctrl-ui/assets/icons/github-logo'
import { useIsMobile } from '@vctrl-ui/hooks/use-mobile'
import { Badge } from '@vctrl-ui/ui/badge'
import { Button } from '@vctrl-ui/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@vctrl-ui/ui/card'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Check, Globe, Sparkle, Wrench } from 'lucide-react'
import { Link, redirect, useNavigate } from 'react-router'

import community from '../../assets/images/community.webp'
import studioDisplay from '../../assets/images/studio-display.jpg'
import { BasicCard, Section } from '../../components'

import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import { Route } from './+types/home-page'
import FiletypeCarousel from './file-type-carousel'
import HeroScene from './hero-scene'
import MockShopSection from './mock-shop-section'

export async function loader({ request }: Route.LoaderArgs) {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	// Create a new URL object to parse the request URL
	const url = new URL(request.url)
	const isRootPage = url.pathname === '/'

	// If the user is authenticated and trying to access the root page, redirect to the dashboard
	// This makes the dashboard the landing page for authenticated users
	if (user && isRootPage) {
		return redirect('/dashboard', {
			headers
		})
	}

	/**
	 * Determine if the request comes from a mobile client by the headers in the request
	 */
	return { isMobile: isMobileRequest(request) }
}

const HomePage = ({ loaderData }: Route.ComponentProps) => {
	const isMobile = useIsMobile(loaderData.isMobile)
	const navigate = useNavigate()
	function handlePublisherClick() {
		navigate('/publisher', { viewTransition: true })
	}

	return (
		<main>
			<section className="-mt-12 flex h-svh flex-col overflow-clip">
				<HeroScene className="-mb-24 h-full w-full grow md:-mb-48" />

				<div className="z-10 flex flex-col items-start justify-center px-4">
					<span className="mx-auto mb-2 flex w-full max-w-5xl flex-wrap gap-2 md:mb-4 md:gap-4">
						<Badge className="bg-muted/50 text-primary/80 border-accent/25 border font-light backdrop-blur-2xl">
							<ArrowUp /> Full control at scale
						</Badge>
						<Badge className="bg-muted/50 text-primary/80 border-accent/25 border font-light backdrop-blur-2xl">
							<Sparkle /> Optimized for performance
						</Badge>
					</span>

					<BasicCard className="relative mx-auto w-full max-w-5xl shadow-lg">
						<CardContent className="text-center">
							<h1 className="from-primary to-primary/50 bg-gradient-to-br bg-clip-text text-3xl leading-tight font-medium text-transparent sm:text-4xl md:text-6xl lg:text-7xl">
								Upload. Prepare. Publish.
							</h1>

							<p className="text-foreground/90 mt-4 text-lg mix-blend-multiply! md:text-xl">
								You've spent hours crafting your 3D model.
								<span className="hidden sm:inline">
									<br />
								</span>
								<strong className="text-foreground font-medium">
									Now it's time to share it
								</strong>
								—with style, speed, and purpose.
							</p>

							<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
								<Button
									onClick={handlePublisherClick}
									size="lg"
									className="group hover:border-accent/50 border-1 transition-all hover:scale-[1.02] hover:animate-pulse"
								>
									<Sparkle className="mr-2 h-5 w-5 transition-all group-hover:rotate-12" />
									Publish Your First Model
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="hover:bg-background/50 border-accent/20 transition-all"
								>
									<GithubLogo className="mr-2 h-5 w-5" />
									Start Contributing
								</Button>
							</div>

							<AnimatePresence>
								{!isMobile && (
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
										className="bg-background/20 mx-auto mt-8 flex max-w-3xl justify-center gap-4 space-x-4 overflow-clip rounded-full border border-white/10 shadow-md backdrop-blur-sm"
									>
										{[
											{ icon: Check, text: 'No registration' },
											{ icon: Check, text: 'Instant publishing' },
											{ icon: Check, text: 'Simple drag & drop' },
											{ icon: Check, text: 'Share immediately' }
										].map((item, i) => (
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
								)}
							</AnimatePresence>
						</CardContent>
					</BasicCard>
				</div>
			</section>

			{/* <div className="to-muted/25 border-muted-foreground/20 -mb-24 overflow-clip border-b bg-linear-to-b from-transparent px-8 py-12 backdrop-blur-2xl" /> */}

			<Section>
				<div className="mb-16 flex flex-col gap-4 text-center">
					<p>Whether you're testing concepts or powering an online store</p>
					<h3>
						Vectreal gives you{' '}
						<span className="text-accent">everything you need</span> to get from
						file to frame.
					</h3>
				</div>
				<BasicCard>
					<CardHeader>
						<span>
							<h2 className="mb-0!">Turn Your Creations Into Experiences</h2>
							<CardDescription>
								No complex pipelines. No vendor lock-in. Just you, your vision,
								and the power to show it off.
							</CardDescription>
						</span>
					</CardHeader>
					<CardContent>
						<p>
							Vectreal is your all-in-one platform for preparing, managing, and
							publishing 3D models for the web.
						</p>
					</CardContent>
				</BasicCard>
			</Section>

			<Section>
				<div className="flex flex-col gap-4">
					<div className="w-full">
						<h2>How It Works</h2>
						<p>Effortless from Start to Finish</p>
					</div>

					<div className="w-full">
						<ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
							<li className="grow">
								<BasicCard highlight className="h-full">
									<CardHeader>
										<CardTitle className="text-4xl font-light">
											0<span className="text-accent pl-1 font-bold">1</span>
										</CardTitle>
										<CardDescription>Upload</CardDescription>
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
										<CardDescription>Optimize & Customize</CardDescription>
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
										<CardDescription>Manage</CardDescription>
									</CardHeader>
									<CardContent>
										<p>
											Secure cloud storage with versioning, asset organization,
											and instant previews.
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
										<CardDescription>Publish</CardDescription>
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
			<Section border>
				<div className="flex flex-col gap-8">
					<div className="flex flex-col gap-4 text-center">
						<h3 className="w-full text-center">
							Have a model? Dive in and show it off.
						</h3>
						<p className="mx-auto max-w-2xl">
							From portfolios to interactive experiences, Vectreal gives your 3D
							models the platform they deserve in under 2 minutes.
						</p>
					</div>

					<div className="flex flex-col gap-4 md:gap-6">
						<div className="flex flex-col-reverse justify-between gap-4 md:grid md:grid-cols-2">
							<div className="flex flex-col gap-4">
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
							<div className="h-full grow overflow-hidden rounded-lg max-md:h-[400px]">
								<img
									src={studioDisplay}
									alt="Studio display"
									className="h-full w-full overflow-clip object-cover shadow-2xl"
								/>
							</div>
						</div>

						<div className="flex w-full flex-col gap-4 px-2 md:items-end">
							<p className="mb-2">
								Ready to transform your 3D content experience?
							</p>
							<Button onClick={handlePublisherClick}>
								<Sparkle className="mr-2" />
								Launch Your First Model
							</Button>
						</div>
					</div>
				</div>
			</Section>

			<MockShopSection />

			<Section>
				<div className="flex flex-col gap-8">
					<div className="w-full">
						<h2>3D Content Drives Customer Engagement</h2>
						<p>
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

			<Section>
				<div className="flex flex-col gap-4">
					<div className="w-full">
						<h2>Ready When You Are</h2>
						<p>From Vision to Virtual in Minutes</p>
						<p>Your 3D Vision Today - No barriers, no waiting</p>
					</div>
					<BasicCard>
						<CardContent className="flex w-full flex-col gap-4 md:flex-row">
							<p className="w-full text-xl">
								Your creative journey is just 120 seconds away.
							</p>
							<div className="flex w-full flex-col gap-2 md:items-end">
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
								<Button className="mt-2" onClick={handlePublisherClick}>
									<Sparkle className="mr-2" />
									Launch Your First Model
								</Button>
							</div>
						</CardContent>
					</BasicCard>
				</div>
			</Section>

			<FiletypeCarousel />

			<Section border>
				<div className="flex flex-col gap-4">
					<span>
						<h2>Powered by Community</h2>
						<p>Vectreal is built by and for the 3D community.</p>
					</span>
					<div className="mt-4 flex w-full flex-col-reverse gap-4 md:grid md:grid-cols-2">
						<ul className="flex flex-col gap-4">
							<li className="bg-muted grid grid-cols-[16px_auto] gap-4 rounded-xl p-4">
								<Check className="mt-1 inline" size={16} /> 100% open-source
							</li>
							<li className="bg-muted grid grid-cols-[16px_auto] gap-4 rounded-xl p-4">
								<Wrench className="mt-1 inline" size={16} /> Built by
								developers, artists, and dreamers
							</li>
							<li className="bg-muted grid grid-cols-[16px_auto] gap-4 rounded-xl p-4">
								<Globe className="mt-1 inline" size={16} /> Global contributors,
								shared knowledge, real collaboration
							</li>
							<li className="mt-auto flex flex-col gap-2">
								<p>
									Join the community that’s reimagining how 3D lives on the web.
								</p>
								<Button className="mt-2">
									<GithubLogo /> Meet the Community
								</Button>
							</li>
						</ul>
						<div className="h-full max-h-[400px] grow overflow-hidden rounded-lg max-md:max-h-[300px]">
							<img
								src={community}
								alt="Studio display"
								className="h-full w-full overflow-clip object-cover shadow-2xl"
							/>
						</div>
					</div>
				</div>
			</Section>

			<Section>
				<div className="flex flex-col gap-4">
					<div className="w-full">
						<h2>Resources & Learning</h2>
						<p>Want to dive deeper?</p>
					</div>

					<Card className="bg-muted/50 flex w-full flex-col gap-4 rounded-xl p-4 md:p-6">
						<CardContent className="p-0">
							<p className="mb-4">
								We've got guides, best practices, case studies, and tutorials to
								help you go from beginner to pro.
							</p>
							<Button className="w-fit">Explore our Knowledge Hub</Button>
						</CardContent>
					</Card>
				</div>
			</Section>
		</main>
	)
}

export default HomePage
