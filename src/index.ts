// Reads X3D scenes, in the XML encoding (.x3d) or the classic VRML encoding (.x3dv), plain or
// gzipped, by turning them into VRML97 for three.js's VRMLLoader: shapes, materials, textures,
// transforms, lights and backgrounds, in metres and Y up.

import * as THREE from 'three';
import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js';
import { countModel, FileManager, ImportFiles, toStandardMaterials, type ImportInput, type ImportStats } from './common.js';
import { convertClassic, convertX3d } from './convert.js';
import { parseXml } from './xml.js';

export { ImportFiles, FileManager, countModel } from './common.js';
export type { ImportInput, ImportFile, ImportData, ImportStats } from './common.js';
export { convertX3d, convertClassic, type Conversion } from './convert.js';
export { parseXml, XmlError, type XmlElement } from './xml.js';

export interface X3dOptions {
  /** The .x3d or .x3dv file to open, if several are given. By default, the first. */
  main?: string;
  /** 'standard' (the default) makes MeshStandardMaterial; 'original' keeps the loader's Phong materials. */
  materialType?: 'standard' | 'original';
  /** Metres per unit, overriding the scene's length unit (metres by default). */
  unitScale?: number;
  /** Keeps the scene's Background node as a sky sphere. Default false. */
  background?: boolean;
}

export interface X3dLoadResult {
  /** The scene, in a group named after the file. */
  group: THREE.Group;
  /** 'xml' for .x3d, 'classic' for .x3dv. */
  encoding: 'xml' | 'classic';
  /** The X3D version and profile the file states. */
  version: string;
  profile: string;
  /** Metres per unit. */
  unitScale: number;
  gzipped: boolean;
  /** Textures the scene uses that were not given. */
  missing: string[];
  /** The VRML97 text the scene was turned into, for checking. */
  vrml: string;
  warnings: string[];
  stats: ImportStats;
}

export class X3dImportError extends Error {
  override name = 'X3dImportError';
}

/** Reads an X3D scene with the textures given beside it. */
export async function loadX3d(input: ImportInput, options: X3dOptions = {}): Promise<X3dLoadResult> {
  const files = await ImportFiles.from(input, 'scene.x3d');
  const main = files.main(['x3d', 'x3dv', 'x3dz', 'x3dvz', 'gz'], options.main) ?? files.files[0];
  if (!main) throw new X3dImportError('There is no .x3d file to open');
  const gzipped = main.bytes[0] === 0x1f && main.bytes[1] === 0x8b;
  let text: string;
  try {
    text = new TextDecoder().decode(gzipped ? gunzipSync(main.bytes) : main.bytes).replace(/^﻿/, '');
  } catch (error) {
    throw new X3dImportError(`${main.name} could not be decompressed: ${(error as Error).message}`);
  }

  const warnings: string[] = [];
  let encoding: 'xml' | 'classic';
  let vrml: string;
  let unit = 1;
  let version = '';
  let profile = '';
  if (/^\s*#X3D\s+V/.test(text)) {
    encoding = 'classic';
    version = /^\s*#X3D\s+V(\d\.\d)/.exec(text)?.[1] ?? '';
    profile = /^\s*PROFILE\s+(\S+)/m.exec(text)?.[1] ?? '';
    ({ vrml, unitScale: unit } = convertClassic(text));
  } else if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<X3D\b/.test(text)) {
    encoding = 'xml';
    let converted;
    try {
      const root = parseXml(text);
      version = root.attributes.version ?? '';
      profile = root.attributes.profile ?? '';
      converted = convertX3d(root);
    } catch (error) {
      throw new X3dImportError(`${main.name} could not be read: ${(error as Error).message}`);
    }
    vrml = converted.vrml;
    unit = converted.unitScale;
    const skipped = Object.entries(converted.skipped);
    if (skipped.length) warnings.push(`Not read: ${skipped.map(([n, c]) => `${n} (${c})`).join(', ')}`);
  } else {
    throw new X3dImportError(`${main.name} is not an X3D file: it has neither an <X3D> element nor a #X3D header`);
  }

  const fm = new FileManager(files);
  const loader = new VRMLLoader(fm.manager);
  let scene: THREE.Scene;
  const unknown = new Set<string>();
  const warn = console.warn;
  try {
    // The loader warns about nodes it doesn't know; they are collected into one warning.
    console.warn = (...args: unknown[]) => {
      const m = /Unknown node: (\w+)|(\w+) node is not supported/i.exec(String(args.join(' ')));
      unknown.add(m?.[1] ?? m?.[2] ?? String(args[0]).replace(/^THREE\.VRMLLoader:\s*/, ''));
    };
    scene = loader.parse(vrml, '');
  } catch (error) {
    throw new X3dImportError(`${main.name} could not be read: ${(error as Error).message}`);
  } finally {
    console.warn = warn;
  }
  await fm.done();
  fm.dispose();
  if (unknown.size) warnings.push(`Not drawn: ${[...unknown].join(', ')}`);

  const name = main.name.replace(/\\/g, '/').split('/').pop()!.replace(/\.(x3dv?z?|gz)$/i, '').replace(/\.x3dv?$/i, '');
  const group = new THREE.Group();
  group.name = name;
  for (const child of [...scene.children]) group.add(child);
  if (!options.background) {
    const skies: THREE.Object3D[] = [];
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry instanceof THREE.SphereGeometry && (m.material as THREE.Material).depthTest === false) skies.push(m);
    });
    for (const sky of skies) {
      const parent = sky.parent!;
      parent.remove(sky);
      if (parent !== group && parent.children.length === 0) parent.removeFromParent();
    }
  }
  if (options.materialType !== 'original') toStandardMaterials(group);
  const unitScale = options.unitScale ?? unit;
  if (unitScale !== 1) group.scale.setScalar(unitScale);
  return { group, encoding, version, profile, unitScale, gzipped, missing: [...fm.missing], vrml, warnings, stats: countModel(group) };
}
