# Formats and support

mc-x3d-import reads X3D with its own XML reader, which turns X3D into VRML97 for three.js's VRMLLoader.

## What is read

- Everything [mc-vrml-import](https://github.com/VJigouline/mc-vrml-import) reads, written as X3D.
- X3D's additions with VRML equivalents: triangle, quad, fan and strip sets, line sets, RGBA colours, double-precision coordinates, and X3D 4 physical, unlit and two-sided materials.
- The scene's length unit (UNIT, or `<unit category="length">`).
- X3D written inside HTML, as X3DOM uses, where element names may be lower case.
- Gzipped files (.x3dz, .x3dvz).

## Orientation and units

X3D is Y up, in metres unless the scene states another length unit.

## Limits

Prototypes, Inline, scripts, sensors, interpolators, routes, metadata and shader nodes are left out; the warnings count each. X3D-only nodes in the classic encoding are not rewritten.
