import { describe, expect, it } from 'vitest'

import { routePageChrome } from './page-chrome'

describe('routePageChrome', () => {
	it('gives public pages both nav and footer', () => {
		for (const pathname of [
			'/pricing',
			'/contact',
			'/docs/guides/upload',
			'/news-room/some-article',
			'/sign-in'
		]) {
			expect(routePageChrome(pathname)).toEqual({
				nav: true,
				footer: true,
				brandPrimary: true,
				brandNavPrimary: true
			})
		}
	})

	/*
	  The hero's main action is the one orange primary in view on the home page,
	  so the nav's "Get started" keeps the ink there and only there.
	*/
	it('keeps the nav primary ink on the home page, and the page primary brand', () => {
		for (const pathname of ['/', '/home']) {
			expect(routePageChrome(pathname)).toEqual({
				nav: true,
				footer: true,
				brandPrimary: true,
				brandNavPrimary: false
			})
		}
	})

	/*
	  The empty publisher is the editor with nothing in it, under the same
	  header, so it drops the nav from the first paint like every scene route.
	  It used to keep it and hide it at runtime once a model arrived.
	*/
	it('drops the nav on the empty publisher too', () => {
		expect(routePageChrome('/publisher')).toEqual({
			nav: false,
			footer: false,
			brandPrimary: false,
			brandNavPrimary: false
		})
		expect(routePageChrome('/publisher/')).toEqual({
			nav: false,
			footer: false,
			brandPrimary: false,
			brandNavPrimary: false
		})
	})

	/*
	  This is the case that must be right during SSR. With a scene id the publisher
	  header owns the top of the viewport from the first paint, so a nav rendered
	  here would be visibly dropped on hydration.
	*/
	it('drops the nav once there is a scene to frame', () => {
		expect(routePageChrome('/publisher/abc123')).toEqual({
			nav: false,
			footer: false,
			brandPrimary: false,
			brandNavPrimary: false
		})
	})

	it('does not let the publisher prefix swallow unrelated paths', () => {
		expect(routePageChrome('/publisher-guide')).toEqual({
			nav: true,
			footer: true,
			brandPrimary: true,
			brandNavPrimary: true
		})
	})
})
