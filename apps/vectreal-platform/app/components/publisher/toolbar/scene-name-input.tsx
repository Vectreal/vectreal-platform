import { useAtom } from 'jotai/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { metaAtom } from '../../../lib/stores/publisher-config-store'

import { useToolbarContext } from './toolbar-context'

export function SceneNameInput() {
	const { setIsSaved } = useToolbarContext()
	const [{ sceneName }, setInfo] = useAtom(metaAtom)
	const [isEditing, setIsEditing] = useState(false)
	const [localName, setLocalName] = useState(sceneName)
	const inputRef = useRef<HTMLInputElement>(null)

	const saveChanges = useCallback(() => {
		const trimmedName = localName.trim()
		if (trimmedName && trimmedName !== sceneName) {
			setInfo((prev) => ({
				...prev,
				sceneName: trimmedName
			}))
			setIsSaved(false)
		} else if (!trimmedName) {
			setLocalName(sceneName) // Revert to previous name if empty
		}

		setIsEditing(false)
	}, [localName, sceneName, setInfo, setIsSaved])

	// Handle clicking outside to save
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node
			const input = inputRef.current

			if (input && !input.contains(target)) saveChanges()
		}

		if (isEditing) document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isEditing, localName, saveChanges])

	// Focus input when editing begins
	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus()
			inputRef.current?.select()
		}
	}, [isEditing])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			saveChanges()
		} else if (e.key === 'Escape') {
			setLocalName(sceneName)
			setIsEditing(false)
		}
	}

	return (
		<div className="relative grow p-2 md:max-w-[400px]">
			{isEditing ? (
				<div className="relative flex w-full items-center">
					<input
						ref={inputRef}
						type="text"
						value={localName}
						onChange={(e) => setLocalName(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={saveChanges}
						className="w-32 grow border-b border-neutral-700 bg-transparent px-2 py-1 text-sm text-white transition-all duration-300 outline-none focus:border-orange-500"
						aria-label="Scene name"
					/>

					{/* Typing indicator */}
					<span
						className="absolute top-1/2 right-2 h-1.5 w-1.5 -translate-y-1/2 transform animate-pulse rounded-full bg-orange-500"
						aria-hidden="true"
					/>
				</div>
			) : (
				<button
					onClick={() => setIsEditing(true)}
					className="flex w-full grow items-center px-2 text-sm text-white/90 transition-all duration-300 hover:scale-[1.02] hover:text-white active:scale-[0.98]"
				>
					<span className="w-full truncate text-left">{sceneName}</span>
				</button>
			)}
		</div>
	)
}
