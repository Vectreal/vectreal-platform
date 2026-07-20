# Draco 3D Data Compression

Draco is an open-source library for compressing and decompressing 3D geometric meshes and point clouds. It is intended to improve the storage and transmission of 3D graphics.

[Website](https://google.github.io/draco/) | [GitHub](https://github.com/google/draco)

## Contents

This folder contains the **glTF** build variant — targeted by the
[glTF mesh compression extension](https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression)
(`KHR_draco_mesh_compression`), tracking the
[corresponding Draco branch](https://github.com/google/draco/tree/gltf_2.0_draco_extension).
Sourced from `node_modules/three/examples/jsm/libs/draco/gltf/` to guarantee
it matches the installed three.js version.

* `draco_decoder.js` — Emscripten-compiled decoder, compatible with any modern browser.
* `draco_decoder.wasm` — WebAssembly decoder, compatible with newer browsers and devices.
* `draco_wasm_wrapper.js` — JavaScript wrapper for the WASM decoder.
* `draco_encoder.js` — Emscripten-compiled encoder, used for producing Draco-compressed output.

Do not swap this for the "default" (master branch) build — it targets a
different bitstream and is not what `KHR_draco_mesh_compression` expects.

This is consumed with `THREE.DRACOLoader`:

```js
var dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('path/to/decoders/');
dracoLoader.setDecoderConfig({type: 'js'}); // (Optional) Override detection of WASM support.
```

Further [documentation on GitHub](https://github.com/google/draco/tree/master/javascript/example#static-loading-javascript-decoder).

## License

[Apache License 2.0](https://github.com/google/draco/blob/master/LICENSE)
