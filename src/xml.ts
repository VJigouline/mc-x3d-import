// A small XML reader: elements with attributes and children, without a DOM, so it runs in Node
// and in workers as well as in browsers.

export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** Text and CDATA inside the element. */
  text: string;
}

export class XmlError extends Error {
  override name = 'XmlError';
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

/** Parses XML text into its root element. */
export function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: '#document', attributes: {}, children: [], text: '' };
  const stack: XmlElement[] = [root];
  const token = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^[>]|\[[\s\S]*?\])*>|<\/\s*([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gy;
  const attribute = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  let at = 0;
  while (at < xml.length && (m = token.exec(xml))) {
    at = token.lastIndex;
    const top = stack[stack.length - 1]!;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) {
      if (top.name !== m[2]) throw new XmlError(`Unexpected </${m[2]}>: <${top.name}> is open`);
      stack.pop();
    } else if (m[3] !== undefined) {
      const element: XmlElement = { name: m[3], attributes: {}, children: [], text: '' };
      for (const a of (m[4] ?? '').matchAll(attribute)) element.attributes[a[1]!] = decodeEntities(a[3] ?? a[4] ?? '');
      top.children.push(element);
      if (!m[5]) stack.push(element);
    } else if (m[6] !== undefined) top.text += decodeEntities(m[6]);
  }
  if (at < xml.length) throw new XmlError(`The XML cannot be read near character ${at}: ${xml.slice(at, at + 40)}`);
  if (stack.length > 1) throw new XmlError(`<${stack[stack.length - 1]!.name}> is not closed`);
  const element = root.children[0];
  if (!element) throw new XmlError('The XML has no root element');
  return element;
}
