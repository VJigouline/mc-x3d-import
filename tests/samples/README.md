# X3D test files

Real X3D files that the tests load. They are unchanged copies, taken at commit `a1e12d27c5` of X3DOM.

| Files | What they cover | Source and licence |
| --- | --- | --- |
| `teapot.x3d`, `asteroid.x3d`, `Deer.x3d` | A lower-case X3DOM scene, an X3DOM shader, and a Blender export | [X3DOM](https://github.com/x3dom/x3dom) (`build/jsdoc/jsdoc-template/base/tutorials`), under its [MIT licence](https://github.com/x3dom/x3dom/blob/master/LICENSE.md) (X3DOM is dual-licensed MIT and GPL; the MIT terms are taken). |

The tests also write their own scenes, with X3D 4 nodes.

These files keep their own licences. They are test data only, and are not part of the npm package, which includes only `dist`, `Documentation`, `README.md` and `LICENSE`.
