interface IconProps {
	className?: string
}

const PlayIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M4.25 2.5a.5.5 0 0 1 .76-.43l8 5a.5.5 0 0 1 0 .86l-8 5A.5.5 0 0 1 4.25 12.5v-10Z"
			fill="currentColor"
		></path>
	</svg>
)

export default PlayIcon
