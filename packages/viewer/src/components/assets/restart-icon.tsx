interface IconProps {
	className?: string
}

const RestartIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M12.5 7.5a5 5 0 1 1-1.72-3.78"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
		></path>
		<path
			d="M12.3 1.9v3h-3"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		></path>
	</svg>
)

export default RestartIcon
