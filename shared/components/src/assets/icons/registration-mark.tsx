/**
 * A printer's registration cross: a hairline plus with a small ring at its
 * center.
 *
 * It marks the corners of a framed stage the way crop marks mark a proof, so a
 * model sitting in it reads as something placed and measured. The stroke
 * follows `currentColor` and stays one pixel wide at any size.
 */
export const RegistrationMark = ({ className }: { className?: string }) => (
	<svg
		className={className}
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1"
		vectorEffect="non-scaling-stroke"
		aria-hidden="true"
	>
		<path d="M8 0v16M0 8h16" vectorEffect="non-scaling-stroke" />
		<circle cx="8" cy="8" r="3" vectorEffect="non-scaling-stroke" />
	</svg>
)
