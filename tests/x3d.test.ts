import * as THREE from 'three';
import { gzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { describe, expect, it } from 'vitest';
import { loadX3d, parseXml, X3dImportError } from '../src/index.js';
import { sample } from './files.js';

const meshes = (g: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh));
  return out;
};

const SCENE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">
<X3D profile='Interchange' version='4.0'>
  <head>
    <meta name='title' content='Test &amp; scene'/>
    <unit category='length' name='millimetre' conversionFactor='0.001'/>
  </head>
  <Scene>
    <!-- a red triangle set and a reused box -->
    <Transform DEF='T' translation='10 0 0'>
      <Shape>
        <Appearance><PhysicalMaterial baseColor='1 0 0' roughness='0.25'/></Appearance>
        <IndexedTriangleSet index='0 1 2 0 2 3' solid='false'>
          <Coordinate point='0 0 0, 100 0 0, 100 100 0, 0 100 0'/>
          <ColorRGBA containerField='color' color='1 0 0 1, 0 1 0 1, 0 0 1 1, 1 1 1 1'/>
        </IndexedTriangleSet>
      </Shape>
    </Transform>
    <Shape DEF='B'><Appearance><Material diffuseColor='0 0 1'/></Appearance><Box size='10 10 10'/></Shape>
    <Transform translation='0 50 0'><Shape USE='B'/></Transform>
    <Shape><LineSet vertexCount='2 3'><Coordinate point='0 0 0 1 0 0 0 1 0 1 1 0 2 2 0'/></LineSet></Shape>
    <TimeSensor loop='true'/>
    <ROUTE fromNode='a' fromField='b' toNode='c' toField='d'/>
  </Scene>
</X3D>`;

describe('XML', () => {
  it('parses elements, attributes, entities and comments', () => {
    const root = parseXml('<?xml version="1.0"?><!-- c --><a x="1 &lt; 2" y=\'q\'><b/><c>text</c></a>');
    expect(root).toMatchObject({ name: 'a', attributes: { x: '1 < 2', y: 'q' } });
    expect(root.children.map((c) => c.name)).toEqual(['b', 'c']);
    expect(root.children[1]!.text).toBe('text');
    expect(() => parseXml('<a><b></a>')).toThrow();
  });
});

describe('X3D', () => {
  it('reads X3D 4 nodes as their VRML equivalents, in the scene unit', async () => {
    const r = await loadX3d({ name: 'test.x3d', data: SCENE });
    expect(r).toMatchObject({ encoding: 'xml', version: '4.0', profile: 'Interchange', unitScale: 0.001 });
    expect(r.warnings.join()).toContain('TimeSensor (1)');
    expect(r.warnings.join()).toContain('ROUTE (1)');
    expect(r.stats.meshes).toBe(3);
    expect(r.stats.lines).toBe(3);
    const tri = meshes(r.group).find((m) => (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) === 6)!;
    expect((tri.material as THREE.MeshStandardMaterial).color.r).toBeCloseTo(1);
    expect(tri.geometry.getAttribute('color')).toBeTruthy();
    r.group.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(tri).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(0.1);
  });

  it('reads the classic encoding, gzipped', async () => {
    const classic = `#X3D V3.3 utf8
PROFILE Interchange
COMPONENT Geometry3D:1
META "title" "classic"
UNIT length centimetre 0.01
Shape { appearance Appearance { material Material { diffuseColor 0 1 0 } } geometry Sphere { radius 50 } }
`;
    const r = await loadX3d({ name: 'ball.x3dvz', data: gzipSync(new TextEncoder().encode(classic)) });
    expect(r).toMatchObject({ encoding: 'classic', version: '3.3', profile: 'Interchange', unitScale: 0.01, gzipped: true });
    const size = new THREE.Box3().setFromObject(r.group).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1);
  });

  it('reads real scenes', async () => {
    const teapot = await loadX3d(sample('teapot.x3d'));
    expect(teapot.stats.triangles).toBeGreaterThan(500);
    const deer = await loadX3d(sample('Deer.x3d'));
    expect(deer.stats.meshes).toBe(4);
    const asteroid = await loadX3d(sample('asteroid.x3d'));
    expect(asteroid.stats.meshes).toBeGreaterThan(0);
  });

  it('refuses files that are not X3D', async () => {
    await expect(loadX3d('<svg/>')).rejects.toThrow(X3dImportError);
    await expect(loadX3d('<X3D><Scene><Shape></Scene></X3D>')).rejects.toThrow(X3dImportError);
  });
});
