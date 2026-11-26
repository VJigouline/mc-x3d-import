# mc-x3d-import

An X3D importer for [three.js](https://threejs.org/), written in TypeScript. It reads X3D scenes, in the XML and classic VRML encodings, plain or gzipped, by turning them into VRML97 for three.js's VRMLLoader: shapes, materials, textures, transforms and lights, in metres and Y up. It was made for [SceneEditor](https://github.com/VJigouline/SceneEditor), and works in any three.js application.

```ts
import { loadX3d } from 'mc-x3d-import';

const result = await loadX3d(input.files);   // the .x3d and its textures
scene.add(result.group);
console.log(result.warnings);       // anything that couldn't be read
```

## What it reads

- Everything [mc-vrml-import](https://github.com/VJigouline/mc-vrml-import) reads, written as X3D.
- X3D's additions with VRML equivalents: triangle, quad, fan and strip sets, line sets, RGBA colours, double-precision coordinates, and X3D 4 physical, unlit and two-sided materials.
- The scene's length unit (UNIT, or `<unit category="length">`).
- X3D written inside HTML, as X3DOM uses, where element names may be lower case.
- Gzipped files (.x3dz, .x3dvz).

Prototypes, Inline, scripts, sensors, interpolators, routes, metadata and shader nodes are left out; the warnings count each. X3D-only nodes in the classic encoding are not rewritten. See [Formats and support](Documentation/Support.md) for the details.

## Install

The package is not on the npm registry. Install it from GitHub:

```sh
npm install github:VJigouline/mc-x3d-import
```

`three` (r160 or later) is a peer dependency. The package builds itself on install.

## Documentation

- [Getting started](Documentation/GettingStarted.md)
- [API](Documentation/API.md)
- [Formats and support](Documentation/Support.md)
- [Using it in SceneEditor](Documentation/SceneEditor.md)

## Development

```sh
npm install
npm test           # unit tests, with Vitest
npm run typecheck
npm run build      # dist/
```

The tests load real X3D files, kept in [`tests/samples`](tests/samples/README.md) with their licences. It needs Node.js 22 or later.

## Licence

[MIT](LICENSE)
