// Turns an X3D scene in the XML encoding into VRML97 text that three.js's VRMLLoader reads.
// X3D's nodes and fields are VRML's with additions: the additions that have VRML equivalents
// (triangle and quad sets, RGBA colours, double coordinates, X3D 4 materials) are rewritten,
// and the rest are left out with a warning.

import type { XmlElement } from './xml.js';

/** Where a child node goes in its parent when it doesn't say, by the child's type. */
const CONTAINER: Record<string, string> = {
  Appearance: 'appearance',
  Material: 'material', TwoSidedMaterial: 'material', PhysicalMaterial: 'material', UnlitMaterial: 'material',
  ImageTexture: 'texture', PixelTexture: 'texture', MovieTexture: 'texture', MultiTexture: 'texture',
  TextureTransform: 'textureTransform',
  Coordinate: 'coord', CoordinateDouble: 'coord',
  Color: 'color', ColorRGBA: 'color',
  Normal: 'normal',
  TextureCoordinate: 'texCoord',
  FontStyle: 'fontStyle',
};
const GEOMETRY = new Set(['Box', 'Cone', 'Cylinder', 'Sphere', 'IndexedFaceSet', 'IndexedLineSet', 'PointSet', 'ElevationGrid', 'Extrusion', 'Text',
  'IndexedTriangleSet', 'TriangleSet', 'IndexedQuadSet', 'QuadSet', 'LineSet', 'IndexedTriangleFanSet', 'IndexedTriangleStripSet', 'TriangleFanSet', 'TriangleStripSet']);
/** Fields whose values are strings, which VRML quotes. */
const STRING_FIELDS = new Set(['url', 'description', 'title', 'string', 'family', 'justify', 'style', 'info', 'language', 'type']);
/** Nodes and statements with no VRML97 equivalent that this reads. */
const SKIPPED = new Set(['ROUTE', 'ProtoDeclare', 'ExternProtoDeclare', 'ProtoInstance', 'Script', 'Inline', 'IMPORT', 'EXPORT', 'field', 'fieldValue', 'IS', 'connect',
  'MetadataString', 'MetadataFloat', 'MetadataDouble', 'MetadataInteger', 'MetadataBoolean', 'MetadataSet', 'TimeSensor', 'TouchSensor', 'PlaneSensor', 'CylinderSensor', 'SphereSensor',
  'ProximitySensor', 'VisibilitySensor', 'PositionInterpolator', 'OrientationInterpolator', 'ColorInterpolator', 'ScalarInterpolator', 'CoordinateInterpolator', 'NormalInterpolator',
  'BooleanFilter', 'BooleanSequencer', 'BooleanToggle', 'BooleanTrigger', 'IntegerSequencer', 'IntegerTrigger', 'TimeTrigger', 'Sound', 'AudioClip', 'NavigationInfo', 'WorldInfo', 'Anchor_']);
/** Attributes that are not fields. */
const NOT_FIELDS = new Set(['DEF', 'USE', 'containerField', 'class', 'id', 'xmlns', 'xmlns:xsd', 'xsd:noNamespaceSchemaLocation', 'profile', 'version', 'mapping', 'onclick']);

/** Nodes with children. */
const GROUPING = new Set(['Transform', 'Group', 'Switch', 'LOD', 'Billboard', 'Collision', 'Anchor', 'StaticGroup']);
/** Node names, so that X3D written inside HTML, where case doesn't matter, is read too. */
const NODES = new Map([...Object.keys(CONTAINER), ...GEOMETRY, ...SKIPPED, 'Transform', 'Group', 'Shape', 'Switch', 'LOD', 'Billboard', 'Collision', 'Anchor',
  'Viewpoint', 'OrthoViewpoint', 'DirectionalLight', 'PointLight', 'SpotLight', 'Background', 'Fog', 'StaticGroup', 'Scene', 'X3D', 'head', 'meta', 'unit', 'component'].map((n) => [n.toLowerCase(), n]));
export const canonical = (name: string) => NODES.get(name.toLowerCase()) ?? name;

export interface Conversion {
  vrml: string;
  /** Metres per length unit, from the scene's UNIT statement. */
  unitScale: number;
  /** X3D nodes that were left out, with counts. */
  skipped: Record<string, number>;
  /** Textures the scene refers to. */
  urls: string[];
}

const numbers = (s: string | undefined) => (s ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);

/** Multiple-value fields, which VRML writes in brackets. */
const MF_FIELDS = new Set(['coordIndex', 'colorIndex', 'normalIndex', 'texCoordIndex', 'point', 'vector', 'height', 'spine', 'crossSection',
  'key', 'keyValue', 'skyColor', 'groundColor', 'skyAngle', 'groundAngle', 'length', 'frontUrl', 'backUrl', 'leftUrl', 'rightUrl', 'topUrl', 'bottomUrl']);
const MF_IN: Record<string, string[]> = { Color: ['color'], Extrusion: ['scale', 'orientation'] };

function fieldValue(node: string, name: string, value: string): string {
  const v = value.trim();
  if (v === 'true' || v === 'false') return v.toUpperCase();
  if (STRING_FIELDS.has(name)) {
    // MFString values are already quoted in X3D; a bare value is one string.
    return v.startsWith('"') ? `[ ${v} ]` : JSON.stringify(v);
  }
  // VRML treats commas as white space.
  return MF_FIELDS.has(name) || MF_IN[node]?.includes(name) ? `[ ${v} ]` : v;
}

export function convertX3d(root: XmlElement): Conversion {
  if (canonical(root.name) !== 'X3D') throw new Error(`The root element is <${root.name}>, not <X3D>`);
  const skipped: Record<string, number> = {};
  const urls: string[] = [];
  let unitScale = 1;
  for (const head of root.children.filter((c) => canonical(c.name) === 'head')) {
    for (const unit of head.children.filter((c) => canonical(c.name) === 'unit' && c.attributes.category === 'length')) unitScale = Number(unit.attributes.conversionFactor) || 1;
  }
  const scene = root.children.find((c) => canonical(c.name) === 'Scene');
  if (!scene) throw new Error('The X3D file has no <Scene>');

  const skip = (name: string) => {
    skipped[name] = (skipped[name] ?? 0) + 1;
  };

  /** Rewrites X3D-only nodes as VRML97 ones; returns undefined to leave the node out. */
  const rewrite = (source: XmlElement): XmlElement | undefined => {
    const e = { ...source, name: canonical(source.name) };
    const a = { ...e.attributes };
    const coordOf = () => e.children.find((c) => CONTAINER[canonical(c.name)] === 'coord');
    const pointCount = () => numbers(coordOf()?.attributes.point).length / 3;
    const faces = (index: number[], size: number) => index.flatMap((v, i) => ((i + 1) % size === 0 ? [v, -1] : [v]));
    switch (e.name) {
      case 'IndexedTriangleSet':
      case 'IndexedQuadSet': {
        const size = e.name === 'IndexedTriangleSet' ? 3 : 4;
        a.coordIndex = faces(numbers(a.index), size).join(' ');
        delete a.index;
        return { ...e, name: 'IndexedFaceSet', attributes: a };
      }
      case 'TriangleSet':
      case 'QuadSet': {
        const size = e.name === 'TriangleSet' ? 3 : 4;
        a.coordIndex = faces([...Array(pointCount()).keys()], size).join(' ');
        return { ...e, name: 'IndexedFaceSet', attributes: a };
      }
      case 'IndexedTriangleFanSet':
      case 'IndexedTriangleStripSet': {
        // Runs separated by -1 become triangles.
        const tris: number[] = [];
        let run: number[] = [];
        const flush = () => {
          for (let i = 2; i < run.length; i++) {
            if (e.name === 'IndexedTriangleFanSet') tris.push(run[0]!, run[i - 1]!, run[i]!);
            else tris.push(...(i % 2 ? [run[i - 1]!, run[i - 2]!, run[i]!] : [run[i - 2]!, run[i - 1]!, run[i]!]));
          }
          run = [];
        };
        for (const v of numbers(a.index)) v < 0 ? flush() : run.push(v);
        flush();
        a.coordIndex = faces(tris, 3).join(' ');
        delete a.index;
        return { ...e, name: 'IndexedFaceSet', attributes: a };
      }
      case 'LineSet': {
        const index: number[] = [];
        let start = 0;
        for (const count of numbers(a.vertexCount)) {
          index.push(...[...Array(count).keys()].map((k) => start + k), -1);
          start += count;
        }
        a.coordIndex = index.join(' ');
        delete a.vertexCount;
        return { ...e, name: 'IndexedLineSet', attributes: a };
      }
      case 'ColorRGBA': {
        const c = numbers(a.color);
        a.color = c.filter((_, i) => i % 4 !== 3).join(' ');
        return { ...e, name: 'Color', attributes: a };
      }
      case 'Background': {
        // Each sky and ground colour after the first needs an angle; three.js fails on extra colours.
        for (const [color, angle] of [['skyColor', 'skyAngle'], ['groundColor', 'groundAngle']] as const) {
          const colours = numbers(a[color]);
          const angles = numbers(a[angle]).length;
          const keep = angle === 'groundAngle' && angles === 0 ? 0 : (angles + 1) * 3;
          if (colours.length > keep) {
            if (keep) a[color] = colours.slice(0, keep).join(' ');
            else delete a[color];
          }
        }
        return { ...e, attributes: a };
      }
      case 'CoordinateDouble':
        return { ...e, name: 'Coordinate' };
      case 'PhysicalMaterial':
        if (a.baseColor) a.diffuseColor = a.baseColor;
        if (a.roughness) a.shininess = String(1 - Number(a.roughness));
        for (const k of ['baseColor', 'metallic', 'roughness', 'occlusionStrength', 'normalScale']) delete a[k];
        return { ...e, name: 'Material', attributes: a };
      case 'UnlitMaterial':
        a.diffuseColor = '0 0 0';
        if (!a.emissiveColor) a.emissiveColor = '1 1 1';
        delete a.normalScale;
        return { ...e, name: 'Material', attributes: a };
      case 'TwoSidedMaterial':
        for (const k of Object.keys(a)) if (k.startsWith('back') || k === 'separateBackColor') delete a[k];
        return { ...e, name: 'Material', attributes: a };
      case 'Material':
        for (const k of Object.keys(a)) if (/Texture(Mapping)?$|^normalScale$|^occlusionStrength$/.test(k)) delete a[k];
        return e;
      default:
        return e;
    }
  };

  const write = (source: XmlElement, indent: string): string | undefined => {
    const kind = canonical(source.name);
    if (SKIPPED.has(kind) || kind.startsWith('Metadata')) {
      skip(kind);
      return undefined;
    }
    if (source.attributes.USE) return `USE ${source.attributes.USE}`;
    const e = rewrite(source);
    if (!e) return undefined;
    const lines: string[] = [];
    const inner = indent + '  ';
    for (const [k, v] of Object.entries(e.attributes)) {
      if (NOT_FIELDS.has(k) || k.includes(':')) continue;
      if (k === 'url') urls.push(...(v.match(/"([^"]*)"/g)?.map((s) => s.slice(1, -1)) ?? [v.trim()]));
      lines.push(`${inner}${k} ${fieldValue(e.name, k, v)}`);
    }
    // Children are grouped by the field they go in.
    const groups = new Map<string, string[]>();
    for (const child of e.children) {
      const kind = canonical(child.name);
      let field = child.attributes.containerField ?? CONTAINER[kind] ?? (GEOMETRY.has(kind) ? 'geometry' : 'children');
      if (field === 'children') {
        // VRML97 names the children of Switch and LOD differently; other nodes have no children.
        if (e.name === 'Switch') field = 'choice';
        else if (e.name === 'LOD') field = 'level';
        else if (!GROUPING.has(e.name)) {
          if (!SKIPPED.has(kind)) skip(kind);
          continue;
        }
      }
      const text = write(child, inner);
      if (text === undefined) continue;
      if (!groups.has(field)) groups.set(field, []);
      groups.get(field)!.push(text);
    }
    for (const [field, nodes] of groups) {
      lines.push(nodes.length === 1 && field !== 'children' ? `${inner}${field} ${nodes[0]!.trimStart()}` : `${inner}${field} [\n${nodes.map((n) => inner + '  ' + n.trimStart()).join('\n')}\n${inner}]`);
    }
    const def = e.attributes.DEF ? `DEF ${e.attributes.DEF} ` : '';
    return `${def}${e.name} {\n${lines.join('\n')}\n${indent}}`;
  };

  const top = scene.children.map((c) => write(c, '')).filter((t): t is string => t !== undefined);
  return { vrml: `#VRML V2.0 utf8\n${top.join('\n')}\n`, unitScale, skipped, urls };
}

/** Turns the classic VRML encoding of X3D (.x3dv) into VRML97 text: its X3D statements are removed. */
export function convertClassic(text: string): { vrml: string; unitScale: number } {
  let unitScale = 1;
  const unit = /^\s*UNIT\s+length\s+\S+\s+([\d.eE+-]+)/m.exec(text);
  if (unit) unitScale = Number(unit[1]) || 1;
  const vrml = text
    .replace(/^#X3D\s+V\d\.\d[^\n]*/, '#VRML V2.0 utf8')
    .replace(/^\s*(PROFILE|COMPONENT|UNIT)\b[^\n]*$/gm, '')
    .replace(/^\s*META\s+"[^"]*"\s+"[^"]*"\s*$/gm, '');
  return { vrml, unitScale };
}
