import type { AuthSession, User } from '@supabase/supabase-js'
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useState
} from 'react'

import { useFetcher } from 'react-router'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'

// Define the interface that will be exposed to consumers
interface IAuthContext {
	user: User | null
	isAuthenticated: boolean
	isLoadingAuth: boolean
	showAuthModal: boolean
	setShowAuthModal: React.Dispatch<React.SetStateAction<boolean>>
	authMode: 'login' | 'register'
	setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'register'>>
	captchaToken: string | null
	setCaptchaToken: React.Dispatch<React.SetStateAction<string | null>>
	login: (
		email: string,
		password: string,
		captchaToken?: string
	) => Promise<void>
	register: (
		email: string,
		password: string,
		captchaToken?: string
	) => Promise<void>
	loginWithGoogle: () => Promise<void>
	logout: () => Promise<void>
	deleteAccount: () => Promise<void>
	resetPassword: (email: string) => Promise<void>
}

export interface AuthSessionUpdate {
	accessToken: string | null
	csrf: string
}

type AuthProviderProps = PropsWithChildren<{
	csrfToken: string
}>

/**
 * Hook that contains all authentication logic
 */
const useCreateAuthContext = (csrf: string): IAuthContext => {
	const [user, setUser] = useState<User | null>(null)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isLoadingAuth, setLoadingAuth] = useState(true)
	const [showAuthModal, setShowAuthModal] = useState(false)
	const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
	const [captchaToken, setCaptchaToken] = useState<string | null>(null)

	const { submit, state } = useFetcher()
	const loadingServerAuth = state !== 'idle'

	/**
	 * Updates the authentication state and syncs with the server
	 */
	const updateAuthState = useCallback(
		async (session?: AuthSession) => {
			try {
				const formData = new FormData()
				formData.append('accessToken', session?.access_token || '')
				formData.append('csrf', csrf) // Use "token" key as required by your CSRF configuration

				await submit(formData, {
					method: 'post',
					action: '/api/update-auth-session'
				})

				setUser(session?.user || null)
				setIsAuthenticated(!!session)
			} catch (error) {
				console.error('Failed to update auth session:', error)
				toast.error('Authentication failed. Please try again.')
			}
		},
		[csrf, submit]
	)

	/**
	 * Gets the current session from Supabase
	 */
	const getSession = useCallback(async () => {
		try {
			const {
				data: { session },
				error: sessionError
			} = await supabase.auth.getSession()

			const {
				data: { user },
				error: userError
			} = await supabase.auth.getUser()

			if (sessionError || userError) {
				console.error('Session retrieval error:', sessionError || userError)
				return
			}

			if (user && session) await updateAuthState(session)
			else await updateAuthState()
		} catch (error) {
			console.error('Failed to retrieve session:', error)
		}
	}, [updateAuthState])

	/**
	 * Sign in with email and password
	 */
	const login = async (
		email: string,
		password: string,
		captchaToken?: string
	) => {
		try {
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
				options: {
					captchaToken: captchaToken || undefined
				}
			})

			if (error) throw error

			toast.success('Signed in successfully!')
			setShowAuthModal(false)
		} catch (error: unknown) {
			console.error('Login error:', error)
			if (error instanceof Error) {
				toast.error(error?.message || 'Failed to sign in. Please try again.')
			}
			throw error
		}
	}

	/**
	 * Register with email and password
	 */
	const register = async (
		email: string,
		password: string,
		captchaToken?: string
	) => {
		try {
			if (password.length < 6) {
				throw new Error('Password must be at least 6 characters long.')
			}

			const { error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					captchaToken: captchaToken || undefined
				}
			})

			if (error) throw error

			toast.success('Account created successfully!')
			setShowAuthModal(false)
		} catch (error: unknown) {
			console.error('Registration error:', error)
			if (error instanceof Error) {
				toast.error(
					error?.message || 'Failed to create account. Please try again.'
				)
			}
			throw error
		}
	}

	/**
	 * Sign in with Google OAuth
	 */
	const loginWithGoogle = async () => {
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: window.location.origin + window.location.pathname
				}
			})

			if (error) throw error

			toast.success('Redirecting to Google...')
		} catch (error: unknown) {
			console.error('Google login error:', error)
			if (error instanceof Error) {
				// Handle specific error messages if needed
				toast.error(
					error?.message || 'Failed to sign in with Google. Please try again.'
				)
			}
			throw error
		}
	}

	/**
	 * Request password reset
	 */
	const resetPassword = async (email: string) => {
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: `${window.location.origin}/reset-password`
			})

			if (error) throw error

			toast.success(
				"If an account with that email exists, you'll receive a reset link."
			)
		} catch (error: unknown) {
			console.error('Reset password error:', error)
			// Still show success to prevent email enumeration
			toast.success(
				"If an account with that email exists, you'll receive a reset link."
			)
		}
	}

	/**
	 * Sign out the current user
	 */
	const logout = async () => {
		try {
			const { error } = await supabase.auth.signOut()
			if (error) throw error

			setUser(null)
			setIsAuthenticated(false)
			await updateAuthState()
		} catch (error) {
			console.error('Error signing out:', error)
			toast.error('Failed to sign out. Please try again.')
		}
	}

	/**
	 * Delete the current user's account
	 */
	const deleteAccount = async () => {
		try {
			if (!user?.id) {
				throw new Error('No user to delete')
			}

			// Use FormData instead of JSON
			const formData = new FormData()
			formData.append('token', csrf)

			// Call our API endpoint to delete the user
			const response = await fetch('/api/delete-user', {
				method: 'POST',
				body: formData
			})

			if (!response.ok) {
				const data = (await response.json()) as { error?: string }
				throw new Error(data.error || 'Failed to delete account')
			}

			await logout()
			toast.success('Account deleted successfully')
		} catch (error: unknown) {
			console.error('Error deleting user:', error)
			if (error instanceof Error) {
				// Handle specific error messages if needed
				// For example, if the user is not found, you might want to show a different message
				toast.error(
					error?.message || 'Failed to delete account. Please try again.'
				)
			}
		}
	}

	// Initialize auth state
	useEffect(() => {
		// On mount, retrieve session
		getSession().finally(() => setLoadingAuth(false))

		// Subscribe to auth state changes
		const { data: authListener } = supabase.auth.onAuthStateChange(
			async (event, session) => {
				if (event === 'SIGNED_IN' && session?.user) {
					await updateAuthState(session)

					// Create DB user if needed
					const createUserFormData = new FormData()
					createUserFormData.append('token', csrf)
					if (session?.access_token) {
						createUserFormData.append('accessToken', session.access_token)
					}

					await submit(createUserFormData, {
						method: 'post',
						action: '/api/create-db-user'
					})
				} else if (event === 'SIGNED_OUT') {
					await updateAuthState()
				}
			}
		)

		return () => {
			authListener?.subscription.unsubscribe()
		}
	}, [csrf, getSession, submit, updateAuthState])

	// Refresh session periodically
	useEffect(() => {
		const interval = setInterval(() => getSession(), 10 * 60 * 1000)
		return () => clearInterval(interval)
	}, [getSession])

	return {
		user,
		isAuthenticated,
		isLoadingAuth: loadingServerAuth || isLoadingAuth,
		showAuthModal,
		setShowAuthModal,
		authMode,
		setAuthMode,
		captchaToken,
		setCaptchaToken,
		login,
		register,
		loginWithGoogle,
		logout,
		deleteAccount,
		resetPassword
	}
}

export const AuthContext = createContext<IAuthContext>({} as IAuthContext)

const AuthProvider = ({ children, csrfToken }: AuthProviderProps) => {
	const value = useCreateAuthContext(csrfToken)
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (context) return context

	throw new Error('useAuth must be used within an AuthProvider')
}
