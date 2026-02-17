import { Input } from '@shared/components/ui/input'
import { useAtom } from 'jotai/react'
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent
} from 'react'

import { metaAtom } from '../../../lib/stores/scene-settings-store'

export function SceneNameInput() {
	const { setIsSaved } = {
		setIsSaved: (_bool: boolean) => {
			return null // Placeholder for context, replace with actual context if needed
		}
	} // Placeholder for context, replace with actual context if needed
	// const { setIsSaved } = useToolbarContext()
	const [{ sceneName }, setInfo] = useAtom(metaAtom)
	const [isEditing, setIsEditing] = useState(false)
	const [localName, setLocalName] = useState(sceneName ?? '')
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
			setLocalName(sceneName ?? '') // Revert to previous name if empty
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

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			saveChanges()
		} else if (e.key === 'Escape') {
			setLocalName(sceneName ?? '')
			setIsEditing(false)
		}
	}

	return (
		<div className="border-muted/50 relative grow border-b p-2 pb-0">
			{isEditing ? (
				<div className="relative flex w-full items-center">
					<Input
						ref={inputRef}
						type="text"
						value={localName}
						onChange={(e) => setLocalName(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={saveChanges}
						className="text-foreground focus: w-32 grow rounded-sm bg-transparent px-2! py-1! text-sm transition-all duration-300 not-[:focus]:border-0"
						aria-label="Scene name"
					/>

					{/* Typing indicator */}
					<span
						className="bg-accent absolute top-1/2 right-2 h-1.5 w-1.5 -translate-y-1/2 transform animate-pulse rounded-full"
						aria-hidden="true"
					/>
				</div>
			) : (
				<button
					onClick={() => setIsEditing(true)}
					className="text-foreground/90 hover:text-foreground flex w-full grow items-center border-3 border-transparent px-2 py-1 text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
				>
					<span className="w-full truncate text-left">{sceneName}</span>
				</button>
			)}
		</div>
	)
}
