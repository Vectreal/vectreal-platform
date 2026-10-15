import * as THREE from 'three'

import { blurFragment, quadVert } from './stage-shaders'

/*
  The ground shadow is two layers, both stored as density (alpha) so strength is
  applied live and tuning never needs a re-bake:
  1. A soft directional shadow accumulated from jittered lights. The hero model's
     ships as a baked image; any other file bakes it once on arrival.
  2. A contact layer rendered from under the ground and blurred, standing in for
     ground occlusion.
  The key is the light the model is shaded by, so the cast shadow falls away from
  the viewer, as in a front-lit product shot. What grounds the object is the
  contact layer: a short reach (only what really touches, not a lens hovering a
  few millimetres up), blurred wide enough to show past the base. A wide blur is
  built from many narrow passes: few wide ones leave visible steps.
*/
export const SHADOW = {
	samples: 96,
	ambient: 0.3,
	skyLow: 0.5,
	key: new THREE.Vector3(3, 5, 4),
	jitter: 2.2,
	planeScale: 2.5,
	opacity: 0.4,
	contactScale: 1.3,
	contactReach: 0.06,
	contactOpacity: 1,
	contactBlur: 4,
	contactPasses: 10
}

/**
 * The ground shadow's bakes, given the stage's renderer, scene and pass camera.
 * They render the scene itself, so they live beside the engine rather than in
 * it: the engine decides when to bake, and this module decides how.
 */
export function createShadowBaker(
	renderer: THREE.WebGLRenderer,
	scene: THREE.Scene,
	passCam: THREE.OrthographicCamera
) {
	const fsQuad = (material: THREE.Material) => {
		const quad = new THREE.Scene()
		quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
		return quad
	}

	const blurPass = new THREE.ShaderMaterial({
		uniforms: {
			t: { value: null as THREE.Texture | null },
			d: { value: new THREE.Vector2() }
		},
		vertexShader: quadVert,
		depthTest: false,
		fragmentShader: blurFragment
	})
	const blurScene = fsQuad(blurPass)
	function blurDensity(
		rt: THREE.WebGLRenderTarget,
		texels: number,
		passes = 2
	) {
		const tmp = rt.clone()
		for (let i = 0; i < passes; i++) {
			blurPass.uniforms.t.value = rt.texture
			blurPass.uniforms.d.value.set(texels / rt.width, 0)
			renderer.setRenderTarget(tmp)
			renderer.render(blurScene, passCam)
			blurPass.uniforms.t.value = tmp.texture
			blurPass.uniforms.d.value.set(0, texels / rt.height)
			renderer.setRenderTarget(rt)
			renderer.render(blurScene, passCam)
		}
		renderer.setRenderTarget(null)
		tmp.dispose()
	}

	/*
	  The bake looks up from under the ground, as the contact pass does. The
	  receiver is opaque and fills the view, and it is always nearer than the
	  model, so only the shadow is written. (Hiding the model by layers does not
	  work: three draws only casters visible to the rendering camera into the
	  shadow map.) The samples are spread evenly, a spiral over the key's disc and
	  the high sky, so the same model always bakes the same image.
	*/
	function bakeDirectional(
		center: THREE.Vector3,
		extent: number,
		radius: number
	) {
		const res = 1024
		const tmp = new THREE.WebGLRenderTarget(res, res)
		const acc = new THREE.WebGLRenderTarget(res, res, {
			type: THREE.HalfFloatType
		})
		const receiver = new THREE.Mesh(
			new THREE.PlaneGeometry(extent, extent),
			new THREE.ShadowMaterial({
				opacity: 1,
				transparent: false,
				side: THREE.DoubleSide
			})
		)
		receiver.rotation.x = -Math.PI / 2
		receiver.position.set(center.x, 0, center.z)
		receiver.receiveShadow = true
		scene.add(receiver)
		const under = new THREE.OrthographicCamera(
			-extent / 2,
			extent / 2,
			extent / 2,
			-extent / 2,
			0,
			1
		)
		under.up.set(0, 0, -1)
		under.position.set(center.x, -0.5, center.z)
		under.lookAt(center.x, 1, center.z)
		const light = new THREE.DirectionalLight(0xffffff, 1)
		light.castShadow = true
		light.shadow.mapSize.set(2048, 2048)
		light.shadow.bias = -0.001
		light.shadow.normalBias = 0.02
		const sc = light.shadow.camera
		sc.left = sc.bottom = -radius * 1.3
		sc.right = sc.top = radius * 1.3
		sc.near = 0.01
		sc.far = radius * 8
		sc.updateProjectionMatrix()
		light.target.position.set(center.x, 0, center.z)
		scene.add(light, light.target)
		const add = new THREE.ShaderMaterial({
			uniforms: { t: { value: tmp.texture }, w: { value: 1 / SHADOW.samples } },
			vertexShader: quadVert,
			fragmentShader: `varying vec2 vUv; uniform sampler2D t; uniform float w; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(t, vUv).a * w); }`,
			blending: THREE.CustomBlending,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.OneFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.OneFactor,
			depthTest: false
		})
		const addScene = fsQuad(add)
		const golden = Math.PI * (3 - Math.sqrt(5))
		const nSky = Math.round(SHADOW.samples * SHADOW.ambient)
		const nKey = SHADOW.samples - nSky
		renderer.setRenderTarget(acc)
		renderer.setClearColor(0, 0)
		renderer.clear()
		for (let i = 0; i < SHADOW.samples; i++) {
			let dir: THREE.Vector3
			if (i < nKey) {
				const r = Math.sqrt((i + 0.5) / nKey) * SHADOW.jitter
				const a = i * golden
				dir = SHADOW.key
					.clone()
					.add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
					.normalize()
			} else {
				const k = i - nKey
				const y = 1 - ((1 - SHADOW.skyLow) * (k + 0.5)) / nSky
				const a = k * golden
				const h = Math.sqrt(1 - y * y)
				dir = new THREE.Vector3(Math.cos(a) * h, y, Math.sin(a) * h)
			}
			light.position.set(center.x, 0, center.z).addScaledVector(dir, radius * 4)
			renderer.setRenderTarget(tmp)
			renderer.clear()
			renderer.render(scene, under)
			renderer.setRenderTarget(acc)
			renderer.autoClear = false
			renderer.render(addScene, passCam)
			renderer.autoClear = true
		}
		renderer.setRenderTarget(null)
		scene.remove(receiver, light, light.target)
		tmp.dispose()
		receiver.geometry.dispose()
		add.dispose()
		blurDensity(acc, 3) // the sky samples are few; unblurred, each one leaves a ghost copy of the shadow
		return acc
	}

	/* Contact: look up from the ground; anything within reach darkens with nearness, then blur. */
	function bakeContact(center: THREE.Vector3, extent: number, reach: number) {
		const rt = new THREE.WebGLRenderTarget(1024, 1024, {
			type: THREE.HalfFloatType
		})
		const cam = new THREE.OrthographicCamera(
			-extent / 2,
			extent / 2,
			extent / 2,
			-extent / 2,
			0,
			reach
		)
		cam.up.set(0, 0, -1)
		cam.position.set(center.x, -reach * 0.001, center.z)
		cam.lookAt(center.x, 1, center.z)
		const near = new THREE.ShaderMaterial({
			side: THREE.DoubleSide,
			uniforms: { uReach: { value: reach } },
			vertexShader: `varying float vH; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
			fragmentShader: `varying float vH; uniform float uReach; void main(){ float d = clamp(1.0 - vH / uReach, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, d * d); }`
		})
		renderer.setRenderTarget(rt)
		renderer.setClearColor(0, 0)
		renderer.clear()
		scene.overrideMaterial = near
		renderer.render(scene, cam)
		scene.overrideMaterial = null
		renderer.setRenderTarget(null)
		near.dispose()
		blurDensity(rt, SHADOW.contactBlur, SHADOW.contactPasses)
		return rt
	}

	/** Density out to a PNG data URL, for the bake script: 512px, the size a soft density loses nothing at. */
	function densityPng(rt: THREE.WebGLRenderTarget) {
		const size = 512
		const out = new THREE.WebGLRenderTarget(size, size)
		const copy = new THREE.ShaderMaterial({
			uniforms: { t: { value: rt.texture } },
			vertexShader: quadVert,
			depthTest: false,
			fragmentShader: `varying vec2 vUv; uniform sampler2D t; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(t, vUv).a); }`
		})
		renderer.setRenderTarget(out)
		renderer.render(fsQuad(copy), passCam)
		renderer.setRenderTarget(null)
		const px = new Uint8Array(size * size * 4)
		renderer.readRenderTargetPixels(out, 0, 0, size, size, px)
		out.dispose()
		copy.dispose()
		const c = document.createElement('canvas')
		c.width = c.height = size
		const ctx = c.getContext('2d')!
		const img = ctx.createImageData(size, size)
		for (let y = 0; y < size; y++)
			img.data.set(
				px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4),
				y * size * 4
			) // GL rows run bottom-up
		ctx.putImageData(img, 0, 0)
		return c.toDataURL('image/png')
	}

	return { bakeDirectional, bakeContact, densityPng }
}
