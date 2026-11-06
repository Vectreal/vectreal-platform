interface IconProps {
	className?: string
}

const ExitFullscreenIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M5.5 2v3.5H2M13 5.5H9.5V2M9.5 13V9.5H13M2 9.5h3.5V13"
			stroke="currentColor"
			strokeWidth="1.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

export default ExitFullscreenIcon
