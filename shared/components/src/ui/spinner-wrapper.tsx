import { PropsWithChildren } from 'react'

export const SpinnerWrapper = ({ children }: PropsWithChildren) => {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-4">
			{children}
		</div>
	)
}
