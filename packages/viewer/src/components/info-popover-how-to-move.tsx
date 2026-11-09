import { useContext } from 'react'

import { describeHowToMove } from './interaction-help'
import { ViewerKeysContext } from './viewer-keys-context'

/**
 * A "How to move" block for the info popover: a line for mouse, touch and
 * keyboard, from the controls the viewer it sits in has on at this moment,
 * a host's runtime overrides included. Draws nothing outside a viewer or
 * when nothing moves.
 */
export const InfoPopoverHowToMove = () => {
	const keys = useContext(ViewerKeysContext)
	const lines = keys ? describeHowToMove(keys) : []
	if (lines.length === 0) return null

	return (
		<>
			<p className="vv:mt-4 vv:mb-1 vv:font-medium">How to move</p>
			<dl className="vv:m-0">
				{lines.map(({ input, text }) => (
					<div key={input} className="vv:flex vv:gap-2">
						<dt className="vv:opacity-50">{input}</dt>
						<dd className="vv:m-0">{text}</dd>
					</div>
				))}
			</dl>
		</>
	)
}
