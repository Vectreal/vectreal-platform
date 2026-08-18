interface IconProps {
	className?: string
}

const PauseIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M4 2.5h2.25v10H4v-10ZM8.75 2.5H11v10H8.75v-10Z"
			fill="currentColor"
		></path>
	</svg>
)

export default PauseIcon
