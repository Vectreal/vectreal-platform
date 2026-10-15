interface IconProps {
	className?: string
}

const ChevronLeftIcon = ({ className }: IconProps) => (
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
			d="M9 3.5 5 7.5l4 4"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		></path>
	</svg>
)

export default ChevronLeftIcon
