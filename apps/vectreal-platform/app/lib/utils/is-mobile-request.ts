export function isMobileRequest(request: Request): boolean {
	const userAgent = request.headers.get('user-agent') || ''
	const mobileUserAgents = [
		'Android',
		'iPhone',
		'iPad',
		'iPod',
		'Opera Mini',
		'BlackBerry',
		'webOS',
		'Mobile'
	]

	return mobileUserAgents.some((mobileUserAgent) =>
		userAgent.includes(mobileUserAgent)
	)
}
