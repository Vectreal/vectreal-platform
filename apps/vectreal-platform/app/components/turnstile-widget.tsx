import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useEffect, useRef } from 'react'

interface TurnstileWidgetProps {
	siteKey: string
	onSuccess: (token: string) => void
	onError?: () => void
	resetNonce?: number
	mode?: 'auto' | 'visible'
}

const modeOptions = {
	auto: {
		appearance: 'interaction-only' as const,
		execution: 'render' as const
	},
	visible: {
		appearance: 'always' as const,
		execution: 'render' as const
	}
}

export function TurnstileWidget({
	siteKey,
	onSuccess,
	onError,
	resetNonce = 0,
	mode = 'auto'
}: TurnstileWidgetProps) {
	const turnstileRef = useRef<TurnstileInstance>(null)

	useEffect(() => {
		if (resetNonce === 0) return
		turnstileRef.current?.reset()
	}, [resetNonce])

	if (!siteKey) return null

	const handleError = () => {
		onError?.()
		turnstileRef.current?.reset()
	}

	return (
		<Turnstile
			ref={turnstileRef}
			scriptOptions={{ defer: true }}
			siteKey={siteKey}
			options={{ ...modeOptions[mode], responseField: false }}
			onSuccess={onSuccess}
			onError={handleError}
			onExpire={handleError}
		/>
	)
}
