# Changelog

## [3.5.0](https://github.com/Vectreal/vectreal-platform/compare/cli-v3.4.0...cli-v3.5.0) (2026-11-14)


### Features

* **cli:** make cameras and hotspots writable through update_scene_settings ([#1288](https://github.com/Vectreal/vectreal-platform/issues/1288)) ([540b469](https://github.com/Vectreal/vectreal-platform/commit/540b469292818708e8fc1f7159007b880107b8e8))
* load environment maps compressed as gain map JPEGs ([#1315](https://github.com/Vectreal/vectreal-platform/issues/1315)) ([619e7c6](https://github.com/Vectreal/vectreal-platform/commit/619e7c650c20813d4826b286c215db8be256e3b7))
* **platform:** reorder cameras in the Publisher; the list is the switcher's order ([#1310](https://github.com/Vectreal/vectreal-platform/issues/1310)) ([fa587b0](https://github.com/Vectreal/vectreal-platform/commit/fa587b0c8e33504e0e53b38508b95818175dcd46))
* **viewer:** no bare stage when a scene scrolls back into view, and Unload when off-screen as a publish setting ([#1347](https://github.com/Vectreal/vectreal-platform/issues/1347)) ([0df7936](https://github.com/Vectreal/vectreal-platform/commit/0df7936b7a65ea25a1bcb9eff04401174f067851))
* **viewer:** one typed message catalog for the viewer's words, each language loaded only when shown ([#1348](https://github.com/Vectreal/vectreal-platform/issues/1348)) ([55eed3a](https://github.com/Vectreal/vectreal-platform/commit/55eed3a5151742cddfe56ac1524f017ec4846a9b))
* **viewer:** tap to activate, chosen per scene in Publish &gt; Viewer ([#1344](https://github.com/Vectreal/vectreal-platform/issues/1344)) ([0c1e1f5](https://github.com/Vectreal/vectreal-platform/commit/0c1e1f5e7b4ae18e35d2177526454522c2c23add))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @vctrl/core bumped to 3.5.0
    * @vctrl/sdk bumped to 3.5.0

## [3.4.0](https://github.com/Vectreal/vectreal-platform/compare/cli-v3.3.0...cli-v3.4.0) (2026-11-04)


### Miscellaneous Chores

* **cli:** Synchronize vectreal-monorepo versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @vctrl/core bumped to 3.4.0
    * @vctrl/sdk bumped to 3.4.0

## [3.3.0](https://github.com/Vectreal/vectreal-platform/compare/cli-v3.2.0...cli-v3.3.0) (2026-11-01)


### Features

* bake ambient occlusion into the published GLB when the lighting says baked ([#1223](https://github.com/Vectreal/vectreal-platform/issues/1223)) ([4aac0f1](https://github.com/Vectreal/vectreal-platform/commit/4aac0f12f379a3ce770f0d9bd9144a50e34dd302))
* **lighting:** bake the studio lights into a light map at publish ([#1225](https://github.com/Vectreal/vectreal-platform/issues/1225)) ([54f093c](https://github.com/Vectreal/vectreal-platform/commit/54f093c74423eadd6a98ac0c3d71dfd9ef48e0b6))
* **publisher:** merge ambient occlusion and baking into one Studio finish surface ([#1230](https://github.com/Vectreal/vectreal-platform/issues/1230)) ([cafdb0d](https://github.com/Vectreal/vectreal-platform/commit/cafdb0d97c8b26a6385922e06557bea6f12eeefb))
* **publisher:** one Lighting tool replaces Environment and Shadows ([#1221](https://github.com/Vectreal/vectreal-platform/issues/1221)) ([d575394](https://github.com/Vectreal/vectreal-platform/commit/d575394c6d5ed92a8515f7206bf1bab4f296b1e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @vctrl/core bumped to 3.3.0
    * @vctrl/sdk bumped to 3.3.0

## [3.2.0](https://github.com/Vectreal/vectreal-platform/compare/cli-v3.1.0...cli-v3.2.0) (2026-10-30)


### Features

* **open-source:** list @vctrl/sdk and @vctrl/cli with the other packages ([#1209](https://github.com/Vectreal/vectreal-platform/issues/1209)) ([9ce7302](https://github.com/Vectreal/vectreal-platform/commit/9ce730267e3c3ae32169c3ba6a6885705355a5bd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @vctrl/core bumped to 3.2.0
    * @vctrl/sdk bumped to 3.2.0

## [3.1.0](https://github.com/Vectreal/vectreal-platform/compare/cli-v3.0.0...cli-v3.1.0) (2026-10-27)


### Miscellaneous Chores

* **cli:** Synchronize vectreal-monorepo versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @vctrl/core bumped to 3.1.0
    * @vctrl/sdk bumped to 3.1.0

## [3.0.0](https://github.com/Vectreal/vectreal-platform/compare/cli-v2.1.0...cli-v3.0.0) (2026-10-23)


### Features

* **cli:** describe_model, a model's bounds, meshes, materials and clips where the viewer places it ([#1177](https://github.com/Vectreal/vectreal-platform/issues/1177)) ([3b8dc04](https://github.com/Vectreal/vectreal-platform/commit/3b8dc04e10aa2d206063c327c88ab00f46ae11dc))
* **cli:** vectreal login, logout, whoami and init ([#1161](https://github.com/Vectreal/vectreal-platform/issues/1161)) ([e890607](https://github.com/Vectreal/vectreal-platform/commit/e890607ed309a0043b041ce8d1f850bad0051353))
* **cli:** vectreal mcp, a stdio MCP server over one operations module ([#1174](https://github.com/Vectreal/vectreal-platform/issues/1174)) ([d476f1b](https://github.com/Vectreal/vectreal-platform/commit/d476f1b5d691d730539c121007eeadd488043c8d))
* publish @vctrl/sdk and @vctrl/cli to npm ([#1180](https://github.com/Vectreal/vectreal-platform/issues/1180)) ([f2384cd](https://github.com/Vectreal/vectreal-platform/commit/f2384cdedd5006cdde2f283531ea001908305b75))


### Bug Fixes

* **cli:** trust a project link's origin only when it is valid and signed in ([#1176](https://github.com/Vectreal/vectreal-platform/issues/1176)) ([138b3ec](https://github.com/Vectreal/vectreal-platform/commit/138b3ec9b52a5bac79bbbb68b11481b883cda192))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @vctrl/core bumped to 3.0.0
    * @vctrl/sdk bumped to 3.0.0
