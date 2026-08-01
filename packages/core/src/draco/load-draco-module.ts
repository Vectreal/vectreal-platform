/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Environment-aware loader for the raw Draco Emscripten module, shared by
 * both the decode path (`ModelLoader`) and the encode path (`ModelOptimizer`).
 *
 * The vendored `draco_decoder.js`/`draco_encoder_wrapper.js` are classic
 * (non-ESM) scripts that assign a `DracoDecoderModule`/`DracoEncoderModule`
 * factory to the global scope. Loading them requires different mechanics
 * depending on where this runs:
 * - Inside a classic Web Worker: `importScripts`.
 * - Inside a module Web Worker: fetch the script and execute it via a
 *   temporary blob module wrapper that publishes the factory on `self`.
 * - On the main thread (browser window): script-tag injection, since
 *   `importScripts` isn't available outside a worker.
 * Node isn't supported here — nothing in this codebase calls ModelLoader or
 * ModelOptimizer server-side today.
 */

export type DracoModuleKind = 'decoder' | 'encoder'

const GLOBAL_FACTORY_NAME: Record<DracoModuleKind, string> = {
	decoder: 'DracoDecoderModule',
	encoder: 'DracoEncoderModule'
}

const FILE_NAME: Record<DracoModuleKind, string> = {
	decoder: 'draco_decoder.js',
	// WASM-backed build; pairs with the sibling `draco_encoder.wasm`, which is
	// resolved through `locateFile` below. Upstream filenames are kept so
	// refreshing the vendored assets stays a straight copy.
	encoder: 'draco_encoder_wrapper.js'
}

const modulePromises = new Map<string, Promise<unknown>>()

function resolveScriptUrl(decoderPath: string, kind: DracoModuleKind): string {
	const base = decoderPath.endsWith('/') ? decoderPath : `${decoderPath}/`
	return `${base}${FILE_NAME[kind]}`
}

type WorkerGlobal = {
	importScripts: (...urls: string[]) => void
} & Record<string, unknown>

type EmscriptenModule = {
	/**
	 * Present on some Emscripten builds and self-referential — see the warning
	 * in `instantiateDracoModule`.
	 */
	then?: unknown
}

type DracoModuleConfig = {
	locateFile: (fileName: string) => string
	onModuleLoaded: (module: EmscriptenModule) => void
	onAbort: (reason: unknown) => void
}

type DracoModuleFactory = (config: DracoModuleConfig) => EmscriptenModule

function getFactoryFromGlobal(
	kind: DracoModuleKind
): DracoModuleFactory | undefined {
	return (self as unknown as Record<string, unknown>)[
		GLOBAL_FACTORY_NAME[kind]
	] as DracoModuleFactory | undefined
}

/**
 * Instantiates a Draco Emscripten module and resolves once its runtime is
 * ready to use.
 *
 * Two build-specific details make this more than `await factory()`:
 *
 * 1. `locateFile` is mandatory. The WASM encoder fetches its sibling
 *    `draco_encoder.wasm` relative to the running script by default, and in a
 *    module worker that script is a `blob:` URL — so the default would 404.
 *
 * 2. The resolved module must not be thenable. Some builds (including the
 *    encoder) define `Module.then = (func) => { ...; func(Module); return
 *    Module }`, resolving with the Module itself. Handing that to the promise
 *    resolution procedure makes it call `then`, receive the same thenable, and
 *    call `then` again — forever. It is a *synchronous* infinite loop: the
 *    thread wedges at 100% CPU and the promise never settles. Stripping `then`
 *    before resolving is what keeps that from happening.
 *
 * `onModuleLoaded` is Draco's own readiness callback and is supported by every
 * vendored build, WASM and asm.js alike.
 */
function instantiateDracoModule(
	factory: DracoModuleFactory,
	scriptUrl: string
): Promise<unknown> {
	const baseUrl = scriptUrl.slice(0, scriptUrl.lastIndexOf('/') + 1)

	return new Promise((resolve, reject) => {
		factory({
			locateFile: (fileName) => `${baseUrl}${fileName}`,
			onModuleLoaded: (module) => {
				delete module.then
				resolve(module)
			},
			// Emscripten aborts (a missing or unservable .wasm, most likely) have
			// no other channel out. Without this the promise would simply never
			// settle, and the caller would sit until some outer timeout fired.
			onAbort: (reason) =>
				reject(
					new Error(
						`Draco module aborted while loading ${scriptUrl}: ${String(reason)}`
					)
				)
		})
	})
}

async function loadInWorker(
	scriptUrl: string,
	kind: DracoModuleKind
): Promise<unknown> {
	const workerGlobal = self as unknown as WorkerGlobal
	workerGlobal.importScripts(scriptUrl)
	const factory = getFactoryFromGlobal(kind)

	if (!factory) {
		throw new Error(
			`Failed to load Draco ${kind}: ${GLOBAL_FACTORY_NAME[kind]} was not defined after importScripts('${scriptUrl}')`
		)
	}

	return instantiateDracoModule(factory, scriptUrl)
}

async function loadInModuleWorker(
	scriptUrl: string,
	kind: DracoModuleKind
): Promise<unknown> {
	const response = await fetch(scriptUrl)
	if (!response.ok) {
		throw new Error(
			`Failed to load Draco ${kind} script from ${scriptUrl} (HTTP ${response.status})`
		)
	}

	const source = await response.text()
	const globalFactoryName = GLOBAL_FACTORY_NAME[kind]
	const moduleSource = `${source}
if (typeof self === 'object' && typeof ${globalFactoryName} !== 'undefined') {
  self[${JSON.stringify(globalFactoryName)}] = ${globalFactoryName};
}
//# sourceURL=${scriptUrl}`
	const blobUrl = URL.createObjectURL(
		new Blob([moduleSource], { type: 'text/javascript' })
	)

	try {
		await import(/* @vite-ignore */ blobUrl)
	} finally {
		URL.revokeObjectURL(blobUrl)
	}

	const factory = getFactoryFromGlobal(kind)

	if (!factory) {
		throw new Error(
			`Failed to load Draco ${kind}: ${GLOBAL_FACTORY_NAME[kind]} was not defined after module import('${scriptUrl}')`
		)
	}

	return instantiateDracoModule(factory, scriptUrl)
}

function canUseImportScripts(): boolean {
	if (
		typeof self === 'undefined' ||
		typeof (self as unknown as Record<string, unknown>)['importScripts'] !==
			'function'
	) {
		return false
	}

	try {
		;(self as unknown as WorkerGlobal).importScripts('data:text/javascript,')
		return true
	} catch {
		return false
	}
}

async function loadInWindow(
	scriptUrl: string,
	kind: DracoModuleKind
): Promise<unknown> {
	await new Promise<void>((resolve, reject) => {
		const script = document.createElement('script')
		script.src = scriptUrl
		script.async = true
		script.onload = () => resolve()
		script.onerror = () =>
			reject(new Error(`Failed to load Draco ${kind} script from ${scriptUrl}`))
		document.head.appendChild(script)
	})

	const factory = (window as unknown as Record<string, unknown>)[
		GLOBAL_FACTORY_NAME[kind]
	] as DracoModuleFactory | undefined

	if (!factory) {
		throw new Error(
			`Failed to load Draco ${kind}: ${GLOBAL_FACTORY_NAME[kind]} was not defined after loading ${scriptUrl}`
		)
	}

	return instantiateDracoModule(factory, scriptUrl)
}

/**
 * Whether the current environment (browser window or Web Worker) can load
 * the Draco Emscripten scripts. False in Node — nothing in this codebase
 * calls ModelLoader/ModelOptimizer/ModelExporter server-side today.
 */
export function canLoadDracoInBrowser(): boolean {
	const isWindow = typeof document !== 'undefined'
	const isWorkerGlobal =
		typeof self !== 'undefined' &&
		typeof (self as unknown as Record<string, unknown>)['postMessage'] ===
			'function' &&
		typeof document === 'undefined'

	return isWindow || isWorkerGlobal
}

/**
 * Loads (and memoizes) the raw Draco Emscripten module for the given kind
 * and decoder path, suitable for `WebIO.registerDependencies({ 'draco3d.decoder' | 'draco3d.encoder': module })`.
 */
export function loadDracoModule(
	kind: DracoModuleKind,
	decoderPath: string
): Promise<unknown> {
	const cacheKey = `${kind}:${decoderPath}`
	const cached = modulePromises.get(cacheKey)
	if (cached) return cached

	const scriptUrl = resolveScriptUrl(decoderPath, kind)

	const isWorker =
		typeof self !== 'undefined' && typeof document === 'undefined'
	const canImportScripts = isWorker && canUseImportScripts()
	const isWindow = typeof document !== 'undefined'

	const promise = canImportScripts
		? loadInWorker(scriptUrl, kind)
		: isWorker
			? loadInModuleWorker(scriptUrl, kind)
			: isWindow
				? loadInWindow(scriptUrl, kind)
				: Promise.reject(
						new Error(
							`Draco ${kind} loading requires a browser (window or worker) environment`
						)
					)

	modulePromises.set(cacheKey, promise)
	return promise
}
