interface IconProps {
	className?: string
}

export const VectrealLogoSmall = ({ className }: IconProps) => {
	return (
		<svg role="img" className={className} viewBox="0 0 120 120">
			<g id="small-logo" data-name="small logo">
				<path
					fill="currentColor"
					d="M100.18,82.41l-26.13.08a15.19,15.19,0,0,1,26.13-.08ZM87.14,105a15.16,15.16,0,0,0,11-4.68l10.8,10.42V97.53H74.05A15.14,15.14,0,0,0,87.14,105Zm9.91-93.25A40.56,40.56,0,0,0,68.41,0H0V60H18.41L31.69,95.7,46,60H63.39l-25.34,60H87.14a30,30,0,1,1,21.78-50.79v-29A39.81,39.81,0,0,0,97.05,11.75Z"
				/>
			</g>
		</svg>
	)
}
