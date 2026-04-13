import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import GoogleLogo from '@shared/components/assets/icons/google-logo'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSubmit } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import { AuthErrorBoundary } from '../../components/errors'
import HeroScene from '../../components/home/hero-scene'

const SignupModel = () => {
	return (
		<div className="relative flex h-full w-full items-center justify-center md:block">
			<HeroScene vertical />
			<div className="absolute right-0 bottom-0 z-10 max-w-1/2 px-8 pb-8">
				<p className="text-primary/75! text-right text-xl! font-extralight!">
					Join our community and start creating amazing{' '}
					<strong className="text-primary">
						3D experiences with Vectreal.
					</strong>
				</p>
			</div>
			<div className="from-background absolute bottom-0 h-96 w-full bg-gradient-to-t to-transparent" />
		</div>
	)
}

const SigninLayout = () => {
	const submit = useSubmit()
	const csrfToken = useAuthenticityToken()
	const location = useLocation()
	const navigate = useNavigate()
	const nextPath =
		new URLSearchParams(location.search).get('next') || '/dashboard'

	const isSignUp = location.pathname.endsWith('/sign-up')

	const [loadingProvider, setLoadingProvider] = useState<
		null | 'google' | 'github'
	>(null)

	function handleSocialLogin(provider: 'google' | 'github') {
		if (loadingProvider) return
		setLoadingProvider(provider)
		const formData = new FormData()
		formData.append('provider', provider)
		formData.append('backURL', nextPath)
		formData.append('csrf', csrfToken)
		// Use a full navigation submit so external OAuth redirects happen in the
		// top-level browsing context instead of a background fetch request.
		submit(formData, {
			method: 'post',
			action: '/auth/social-signin'
		})
	}

	const handleSwitch = () => {
		navigate(`${isSignUp ? '/sign-in' : '/sign-up'}${location.search}`, {
			viewTransition: true
		})
	}

	return (
		<main className="h-full min-h-screen w-full overflow-hidden">
			<section className="flex min-h-screen w-full flex-col overflow-hidden">
				<div className="grid grow overflow-hidden md:grid-cols-[1fr_1fr]">
					<div className="bg-card relative flex flex-col justify-center border-r p-8 shadow-2xl">
						<div className="mx-auto flex max-w-md flex-col gap-8 py-16">
							<div className="flex grow flex-col justify-end">
								<h1 className="mb-6 text-2xl leading-tight font-medium sm:text-3xl md:text-4xl lg:text-5xl">
									{isSignUp ? 'Sign Up' : 'Sign In'}
								</h1>
							</div>

							<div className="flex w-full flex-col gap-4 md:flex-row">
								<Button
									className="grow"
									onClick={() => handleSocialLogin('google')}
									disabled={loadingProvider !== null}
									style={{
										opacity: loadingProvider === 'github' ? 0.45 : 1,
										transition: 'opacity 0.2s ease'
									}}
								>
									<span className="relative flex items-center justify-center gap-2">
										{/* Idle label — defines the button width */}
										<span
											className="flex items-center gap-2 transition-opacity duration-150"
											style={{ opacity: loadingProvider === 'google' ? 0 : 1 }}
										>
											<GoogleLogo className="h-4 w-4" /> Continue with Google
										</span>
										{/* Loading overlay — absolutely positioned, same space */}
										<span
											className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150"
											style={{ opacity: loadingProvider === 'google' ? 1 : 0 }}
											aria-hidden={loadingProvider !== 'google'}
										>
											<Loader2 className="h-4 w-4 animate-spin" />
											Connecting…
										</span>
									</span>
								</Button>
								<Button
									className="grow"
									onClick={() => handleSocialLogin('github')}
									disabled={loadingProvider !== null}
									style={{
										opacity: loadingProvider === 'google' ? 0.45 : 1,
										transition: 'opacity 0.2s ease'
									}}
								>
									<span className="relative flex items-center justify-center gap-2">
										<span
											className="flex items-center gap-2 transition-opacity duration-150"
											style={{ opacity: loadingProvider === 'github' ? 0 : 1 }}
										>
											<GithubLogo className="h-4 w-4" /> Continue with GitHub
										</span>
										<span
											className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150"
											style={{ opacity: loadingProvider === 'github' ? 1 : 0 }}
											aria-hidden={loadingProvider !== 'github'}
										>
											<Loader2 className="h-4 w-4 animate-spin" />
											Connecting…
										</span>
									</span>
								</Button>
							</div>
							<AnimatePresence>
								{loadingProvider && (
									<motion.p
										initial={{ opacity: 0, y: -6 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -6 }}
										transition={{ duration: 0.2, ease: 'easeOut' }}
										className="text-muted-foreground -mt-4 text-center text-sm"
									>
										Redirecting to{' '}
										{loadingProvider === 'google' ? 'Google' : 'GitHub'}…
									</motion.p>
								)}
							</AnimatePresence>
							<span className="relative">
								<Separator />
								<p className="bg-card text-muted-foreground absolute left-1/2 -translate-x-1/2 -translate-y-3 px-2">
									or
								</p>
							</span>

							<Outlet />

							<div className="mt-4 flex grow flex-col items-center justify-between">
								<button
									type="button"
									className="text-muted-foreground text-sm transition-colors hover:underline"
									onClick={handleSwitch}
								>
									{isSignUp
										? 'Already have an account? Sign in'
										: "Don't have an account? Sign up"}
								</button>
								<p className="text-muted-foreground mt-2 max-w-xs text-center text-xs">
									By continuing, you agree to our{' '}
									<Link
										viewTransition
										to="/privacy-policy"
										className="hover:text-primary underline"
									>
										Privacy Policy
									</Link>{' '}
									and{' '}
									<Link
										viewTransition
										to="/terms-of-service"
										className="hover:text-primary underline"
									>
										Terms of Service
									</Link>
									.
								</p>
							</div>
						</div>
					</div>
					<div className="bg-muted/50 hidden items-center justify-center md:flex">
						<SignupModel />
					</div>
				</div>
			</section>
		</main>
	)
}

export default SigninLayout

export { AuthErrorBoundary as ErrorBoundary }
