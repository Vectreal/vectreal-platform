interface IconProps {
	className?: string
}

const EnterFullscreenIcon = ({ className }: IconProps) => (
	<svg
		className={className}
		width="15"
		height="15"
		viewBox="0 0 15 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M2 5.5V2h3.5M9.5 2H13v3.5M13 9.5V13H9.5M5.5 13H2V9.5"
			stroke="currentColor"
			strokeWidth="1.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

export default EnterFullscreenIcon
