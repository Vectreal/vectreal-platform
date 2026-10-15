interface IconProps {
	className?: string
}

const CheckIcon = ({ className }: IconProps) => (
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
			d="M3.5 7.75 6.25 10.5 11.5 4.5"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		></path>
	</svg>
)

export default CheckIcon
