import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

interface TurnstileWidgetProps {
	siteKey: string
	onSuccess: (token: string) => void
	onError?: () => void
	onWidgetLoad?: () => void
	resetNonce?: number
	mode?: 'auto' | 'visible' | 'invisible'
}

export interface TurnstileWidgetHandle {
	execute: () => void
	reset: () => void
	remove: () => void
	getResponse: () => string | undefined
}

export const TurnstileWidget = forwardRef<
	TurnstileWidgetHandle,
	TurnstileWidgetProps
>(function TurnstileWidget(
	{ siteKey, onSuccess, onError, onWidgetLoad, resetNonce = 0, mode = 'auto' },
	ref
) {
	const turnstileRef = useRef<TurnstileInstance>(null)

	const resolvedOptions =
		mode === 'visible'
			? { appearance: 'always' as const, execution: 'render' as const }
			: mode === 'invisible'
				? {
						appearance: 'interaction-only' as const,
						execution: 'render' as const
					}
				: { execution: 'render' as const }

	useImperativeHandle(ref, () => ({
		execute: () => {
			turnstileRef.current?.execute()
		},
		reset: () => {
			turnstileRef.current?.reset()
		},
		remove: () => {
			turnstileRef.current?.remove()
		},
		getResponse: () => turnstileRef.current?.getResponse()
	}))

	useEffect(() => {
		if (resetNonce === 0) {
			return
		}

		turnstileRef.current?.reset()
	}, [resetNonce])

	if (!siteKey) {
		return null
	}

	const handleError = () => {
		onError?.()
		turnstileRef.current?.reset()
	}

	return (
		<Turnstile
			ref={turnstileRef}
			siteKey={siteKey}
			onWidgetLoad={onWidgetLoad}
			options={{
				...resolvedOptions,
				responseField: false
			}}
			onSuccess={onSuccess}
			onError={handleError}
			onExpire={handleError}
		/>
	)
})
