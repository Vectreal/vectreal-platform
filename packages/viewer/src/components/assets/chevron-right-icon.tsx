interface IconProps {
	className?: string
}

const ChevronRightIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M6 3.5l4 4-4 4"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		></path>
	</svg>
)

export default ChevronRightIcon
