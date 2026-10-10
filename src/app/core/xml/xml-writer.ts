/**
 * A small streaming XML writer that produces indented, well-formed output.
 * Characters that XML 1.0 forbids are dropped rather than written.
 */

// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function cleanXmlText(value: string): string {
  return value.replace(INVALID_XML_CHARS, '');
}

export function escapeText(value: string): string {
  return cleanXmlText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(value: string): string {
  return cleanXmlText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

export type Attrs = [name: string, value: string | number | boolean | undefined | null][];

export class XmlWriter {
  private readonly parts: string[] = [];
  private readonly stack: string[] = [];

  constructor(private readonly indentUnit = '  ') {}

  declaration(): this {
    this.parts.push('<?xml version="1.0" encoding="UTF-8"?>\n');
    return this;
  }

  open(name: string, attrs: Attrs = []): this {
    this.parts.push(`${this.indent()}<${name}${formatAttrs(attrs)}>\n`);
    this.stack.push(name);
    return this;
  }

  close(): this {
    const name = this.stack.pop();
    if (!name) throw new Error('XmlWriter: close() without open()');
    this.parts.push(`${this.indent()}</${name}>\n`);
    return this;
  }

  /** `<name attrs/>` or `<name attrs>text</name>`. */
  element(name: string, attrs: Attrs = [], text?: string): this {
    const a = formatAttrs(attrs);
    if (text === undefined || text === '') this.parts.push(`${this.indent()}<${name}${a}/>\n`);
    else this.parts.push(`${this.indent()}<${name}${a}>${escapeText(text)}</${name}>\n`);
    return this;
  }

  /** Writes already-serialised XML (preserved extension content) as is. */
  raw(xml: string): this {
    this.parts.push(`${this.indent()}${xml.trim()}\n`);
    return this;
  }

  toString(): string {
    if (this.stack.length) throw new Error(`XmlWriter: unclosed <${this.stack[this.stack.length - 1]}>`);
    return this.parts.join('');
  }

  private indent(): string {
    return this.indentUnit.repeat(this.stack.length);
  }
}

function formatAttrs(attrs: Attrs): string {
  let out = '';
  for (const [name, value] of attrs) {
    if (value === undefined || value === null || value === '') continue;
    out += ` ${name}="${escapeAttr(String(value))}"`;
  }
  return out;
}
