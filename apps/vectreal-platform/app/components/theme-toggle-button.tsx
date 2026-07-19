import { Button } from '@shared/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher, useLocation } from 'react-router'

import { applyTheme, isForceDarkRoute } from './theme'

export function ThemeToggleButton() {
	const fetcher = useFetcher()
	const location = useLocation()
	const [isDarkMode, setIsDarkMode] = useState(false)

	useEffect(() => {
		if (typeof document === 'undefined') {
			return
		}

		setIsDarkMode(document.documentElement.classList.contains('dark'))
	}, [location.pathname])

	function handleToggle() {
		const nextMode = isDarkMode ? 'light' : 'dark'
		setIsDarkMode(nextMode === 'dark')
		applyTheme(nextMode, isForceDarkRoute(location.pathname))

		fetcher.submit(
			{ themeMode: nextMode },
			{
				method: 'post',
				action: '/api/theme'
			}
		)
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={handleToggle}
			aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
			title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
		>
			{isDarkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
		</Button>
	)
}
