import React, { createContext, useContext, useEffect, useState } from 'react'

type ToolbarContextType = {
	isSaved: boolean
	setIsSaved: (value: boolean) => void
	activeMode: 'optimize' | 'compose'
	setActiveMode: (mode: 'optimize' | 'compose') => void
	sceneName: string
	setSceneName: (name: string) => void
	isSaving: boolean
	setIsSaving: (saving: boolean) => void
}

const ToolbarContext = createContext<ToolbarContextType | undefined>(undefined)

export const ToolbarProvider: React.FC<{ children: React.ReactNode }> = ({
	children
}) => {
	const [isSaved, setIsSaved] = useState(true)
	const [activeMode, setActiveMode] = useState<'optimize' | 'compose'>(
		'optimize'
	)
	const [sceneName, setSceneName] = useState('Untitled Scene')
	const [isSaving, setIsSaving] = useState(false)

	// Simulate auto-save functionality
	useEffect(() => {
		if (sceneName && !isSaved && !isSaving) {
			const timer = setTimeout(() => {
				setIsSaving(true)

				// Simulate saving process
				setTimeout(() => {
					setIsSaved(true)
					setIsSaving(false)
				}, 800)
			}, 1000)

			return () => clearTimeout(timer)
		}
	}, [sceneName, isSaved, isSaving])

	return (
		<ToolbarContext.Provider
			value={{
				isSaved,
				setIsSaved,
				activeMode,
				setActiveMode,
				sceneName,
				setSceneName,
				isSaving,
				setIsSaving
			}}
		>
			{children}
		</ToolbarContext.Provider>
	)
}

export const useToolbarContext = () => {
	const context = useContext(ToolbarContext)
	if (context === undefined) {
		throw new Error('useToolbarContext must be used within a ToolbarProvider')
	}
	return context
}
