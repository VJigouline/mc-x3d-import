# API

## `loadX3d(input, options?)`

Reads `.x3d` (XML) or `.x3dv` (classic encoding), plain or gzipped, with its textures and returns a promise of a `X3dLoadResult`.

`input` is the file's contents (`ArrayBuffer`, `Uint8Array` or string), a browser `File`, `{ name, data }`, or an iterable of files for a model in several files. Zip archives among them are opened.

It throws a `X3dImportError` for input that isn't X3D.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `main` | the first .x3d file | The file to open, if several are given. |
| `materialType` | 'standard' | `'standard'` or `'original'`. |
| `background` | false | Keeps the Background node. |
| `unitScale` | from the scene | Metres per unit. |

### `X3dLoadResult`

| Field | Type | Meaning |
| --- | --- | --- |
| `group` | `THREE.Group` | The model. |
| `encoding` | `'xml' \| 'classic'` | The file's encoding. |
| `version` | `string` | The X3D version. |
| `profile` | `string` | The X3D profile. |
| `unitScale` | `number` | Metres per unit. |
| `vrml` | `string` | The VRML97 text the scene was turned into. |
| `missing` | `string[]` | Textures that were not given. |
| `warnings` | `string[]` | Problems that didn't stop the import. |
| `stats` | object | Counts of meshes, triangles, lines and points. |

See the package's `index.d.ts` for every exported type and helper.
