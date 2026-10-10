/**
 * A one-page PDF holding a JPEG image the size of the page. Small and enough
 * for printing a poster at home or in a copy shop; the SVG export is there for
 * anything that needs vector lines.
 */
export function pdfFromJpeg(jpeg: Uint8Array, pixelWidth: number, pixelHeight: number, pageWidthPt: number, pageHeightPt: number, title = ''): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const p of Array.isArray(body) ? body : [body]) push(p);
    push('\nendobj\n');
  };

  const W = num(pageWidthPt);
  const H = num(pageHeightPt);
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;

  push('%PDF-1.4\n%âãÏÓ\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`);
  object(4, [
    `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  ]);
  object(5, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title ${pdfText(title)} /Producer (Stemma) /Creator (Stemma) >>`);

  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let i = 1; i <= 6; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** A PDF text string in UTF-16BE, so titles in any language survive. */
function pdfText(s: string): string {
  let hex = 'FEFF';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else {
      hex += cp.toString(16).padStart(4, '0');
    }
  }
  return `<${hex.toUpperCase()}>`;
}
