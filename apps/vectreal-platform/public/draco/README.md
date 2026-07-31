# Draco 3D Data Compression

Draco is an open-source library for compressing and decompressing 3D geometric meshes and point clouds. It is intended to improve the storage and transmission of 3D graphics.

[Website](https://google.github.io/draco/) | [GitHub](https://github.com/google/draco)

## Contents

### Decoders — glTF build variant

Sourced from `node_modules/three/examples/jsm/libs/draco/gltf/`, so they match
the installed three.js version. `THREE.DRACOLoader` picks between them.

* `draco_decoder.js` — Emscripten-compiled decoder, compatible with any modern browser.
* `draco_decoder.wasm` — WebAssembly decoder, compatible with newer browsers and devices.
* `draco_wasm_wrapper.js` — JavaScript wrapper for the WASM decoder.

### Encoder — Draco 1.5.7

Sourced from
[`google/draco@1.5.7/javascript`](https://github.com/google/draco/tree/1.5.7/javascript).
Upstream filenames are kept so refreshing these is a straight copy.

* `draco_encoder_wrapper.js` — JavaScript wrapper for the WASM encoder.
* `draco_encoder.wasm` — WebAssembly encoder.

The encoder is deliberately **not** taken from three.js's `gltf/` folder. That
build predates `ExpertEncoder`, which `@gltf-transform/extensions` requires for
per-attribute quantization — with it, encoding throws immediately. It also
ships as asm.js only, which benchmarks ~8x slower than this WASM build.

Verified: geometry encoded by 1.5.7 decodes correctly with the glTF-variant
decoders above, so the two sets can be updated independently.

### Loading

Both are loaded by `packages/core/src/draco/load-draco-module.ts`, which must
pass `locateFile` so `draco_encoder_wrapper.js` can find its sibling `.wasm`
(inside a module worker the script runs from a `blob:` URL, where the default
relative resolution fails).

This is consumed with `THREE.DRACOLoader`:

```js
var dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('path/to/decoders/');
dracoLoader.setDecoderConfig({type: 'js'}); // (Optional) Override detection of WASM support.
```

Further [documentation on GitHub](https://github.com/google/draco/tree/master/javascript/example#static-loading-javascript-decoder).

## License

[Apache License 2.0](https://github.com/google/draco/blob/master/LICENSE)
