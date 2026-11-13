/*
  jsdom has no 2D context because its optional `canvas` peer is never built (see
  `ignoredBuiltDependencies` in pnpm-workspace.yaml). Its `getContext` already
  returns null, and code here already checks for that; it also prints "Not
  implemented" through jsdom's virtual console on every call. Answering null
  directly keeps every spec on the same path without the message.
*/
if (typeof HTMLCanvasElement !== 'undefined') {
	HTMLCanvasElement.prototype.getContext = (() =>
		null) as typeof HTMLCanvasElement.prototype.getContext
}

/*
  Same for `window.scrollTo`: a no-op in jsdom that prints "Not implemented"
  on every call.
*/
if (typeof window !== 'undefined') {
	window.scrollTo = (() => undefined) as typeof window.scrollTo
}
