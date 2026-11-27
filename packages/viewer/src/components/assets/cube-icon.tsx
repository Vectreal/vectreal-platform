interface IconProps {
	className?: string
}

/** A cube in three-quarter view: the scene is three-dimensional. */
const CubeIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.25"
		strokeLinejoin="round"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
	>
		<path d="M8 1.75 13.75 5v6L8 14.25 2.25 11V5L8 1.75Z" />
		<path d="M2.25 5 8 8.25 13.75 5M8 8.25v6" />
	</svg>
)

export default CubeIcon
