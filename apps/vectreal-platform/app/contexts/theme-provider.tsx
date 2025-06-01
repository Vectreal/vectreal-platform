import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState
} from 'react'
import { useFetcher } from 'react-router'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
	children: React.ReactNode
	defaultTheme?: Theme
	storageKey?: string
}

type ThemeProviderState = {
	theme: Theme
	setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
	theme: 'system',
	setTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function getTheme(defaultTheme: Theme = 'system'): Theme {
	if (typeof window === 'undefined') return defaultTheme

	if (defaultTheme === 'system') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light'
	}

	return defaultTheme
}

function ThemeProvider({
	children,
	defaultTheme = 'system',
	storageKey = 'theme-mode',
	...props
}: ThemeProviderProps) {
	const { submit } = useFetcher()
	const [theme, setTheme] = useState<Theme>(() => getTheme(defaultTheme))

	function updateTheme(themeClass: string) {
		const root = window.document.documentElement

		setTheme(themeClass as Theme)

		root.classList.remove('dark', 'light')
		root.classList.add(themeClass)

		submit(
			{ themeMode: themeClass },
			{
				method: 'post',
				action: '/api/update-theme'
			}
		)
	}

	const updateThemeMemoized = useCallback(updateTheme, [submit])

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

		if (theme === 'system') {
			const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
				.matches
				? 'dark'
				: 'light'

			updateThemeMemoized(systemTheme)
		}

		// Listen for system theme changes
		function handleChangeCallback() {
			if (theme === 'system')
				updateThemeMemoized(mediaQuery.matches ? 'dark' : 'light')
		}

		mediaQuery.addEventListener('change', handleChangeCallback)

		updateThemeMemoized(theme)

		return () => mediaQuery.removeEventListener('change', handleChangeCallback)
	}, [theme, storageKey, updateThemeMemoized])

	const value = {
		theme,
		setTheme: updateTheme
	}

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	)
}

export default ThemeProvider

export const useTheme = () => {
	const context = useContext(ThemeProviderContext)

	if (context === undefined)
		throw new Error('useTheme must be used within a ThemeProvider')

	return context
}
