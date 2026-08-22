# Changelog

## [1.0.0](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.25.1...embed-v1.0.0) (2026-08-22)


### ⚠ BREAKING CHANGES

* **hooks:** `ShadowsProps` is a plain interface rather than a union discriminated on `type`, so a consumer still passing `type: 'accumulative'` is passing an unknown property.

### Features

* **viewer:** play glTF animation clips ([035b217](https://github.com/Vectreal/vectreal-platform/commit/035b217448803f9008d136f1c12836189d0c2898))
* **viewer:** play glTF animation clips ([11ff088](https://github.com/Vectreal/vectreal-platform/commit/11ff0880eb32ef0bda03196fe74de4955452d2f1))


### Bug Fixes

* **build:** make the package typecheck gates actually compile something ([#723](https://github.com/Vectreal/vectreal-platform/issues/723)) ([38c6487](https://github.com/Vectreal/vectreal-platform/commit/38c64879a00c1774df970effa09cff38396233ec))
* **hooks:** keep a failed upload from hiding a failed scene load ([5e9676f](https://github.com/Vectreal/vectreal-platform/commit/5e9676f01f61aa53ab74ec3e3fb2d78283fe7045))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @vctrl/viewer bumped to 1.0.0

## [0.25.1](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.25.0...embed-v0.25.1) (2026-08-08)


### Miscellaneous Chores

* **embed:** Synchronize vectreal-monorepo versions

## [0.25.0](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.24.1...embed-v0.25.0) (2026-08-04)


### Bug Fixes

* **packages:** match repository.url org casing for npm provenance ([455caa9](https://github.com/Vectreal/vectreal-platform/commit/455caa927ff7a668ea2b6af6a633d9057d69f203))
* **packages:** match repository.url org casing for npm provenance ([7289fdc](https://github.com/Vectreal/vectreal-platform/commit/7289fdcbc5678588acccaf5b650d62a4d70a7e10))

## [0.24.1](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.24.0...embed-v0.24.1) (2026-08-02)


### Bug Fixes

* **ci:** resolve workspace protocol at publish time and publish via OIDC ([07e4b62](https://github.com/Vectreal/vectreal-platform/commit/07e4b628be16b61f3ddea9c91cc36c052d60bc8f))
* **ci:** resolve workspace protocol at publish time and publish via OIDC ([03b9305](https://github.com/Vectreal/vectreal-platform/commit/03b9305719b1cf67548f62730493ca6e3a84c823))

## [0.24.0](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.22.0...embed-v0.24.0) (2026-08-01)


### Features

* **platform:** split /embed from /preview ([#662](https://github.com/Vectreal/vectreal-platform/issues/662)) ([19d9ec5](https://github.com/Vectreal/vectreal-platform/commit/19d9ec5cfa63a83fd04efbebb16ccac588fc325b))

## [0.22.0](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.21.0...embed-v0.22.0) (2026-07-01)


### Features

* enhance @vctrl/core documentation and improve package structure ([f74b8c8](https://github.com/Vectreal/vectreal-platform/commit/f74b8c881b0dad4ef35da0013492adfd5bde0ed9))
* enhance @vctrl/core documentation and improve package structure ([6599388](https://github.com/Vectreal/vectreal-platform/commit/65993883139d8fb0ab52839b14068276f482642a))
* enhance mock shop embed client and section with improved UI elements and interactions ([#529](https://github.com/Vectreal/vectreal-platform/issues/529)) ([0a9a780](https://github.com/Vectreal/vectreal-platform/commit/0a9a780bb7e593049a2cf0c835adc6a093c54ad1))

## [0.21.0](https://github.com/Vectreal/vectreal-platform/compare/embed-v0.20.0...embed-v0.21.0) (2026-05-21)


### Features

* **embed:** update package version to 0.20.0 and configure release settings ([#526](https://github.com/Vectreal/vectreal-platform/issues/526)) ([7d6aa97](https://github.com/Vectreal/vectreal-platform/commit/7d6aa97ecf5f372ac46aec4cc72a4d294b7fcdfa))
* Remove official-website in favor of vectreal-platform app ([#198](https://github.com/Vectreal/vectreal-platform/issues/198)) ([3c1019e](https://github.com/Vectreal/vectreal-platform/commit/3c1019ea1950ce1c99247c957e983078b563ce80))


### Reverts

* remove release-please generated v0.14.0 changelog entry ([#366](https://github.com/Vectreal/vectreal-platform/issues/366)) ([4ef3b61](https://github.com/Vectreal/vectreal-platform/commit/4ef3b617e7b0a14fe5001b5371f67f2d65cdf819))
