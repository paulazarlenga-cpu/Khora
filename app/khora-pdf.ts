export type KhoraPdfInput = {
  title: string;
  reference: string;
  meta: string[];
  lines: string[];
  footer?: string;
};

function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-").replace(/([\\()])/g, "\\$1");
}

function textLine(value: string, x: number, y: number, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
}

export function buildKhoraPdf(input: KhoraPdfInput) {
  const rows = [...input.meta, "", ...input.lines];
  const pages: string[][] = [];
  for (let index = 0; index < rows.length; index += 38) pages.push(rows.slice(index, index + 38));
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pageRows, pageIndex) => {
    const pageId = pageObjectIds[pageIndex], contentId = pageId + 1;
    const content = [
      textLine("KHORA", 48, 800, 18),
      textLine(input.title, 48, 775, 15),
      textLine(input.reference, 48, 755, 10),
      ...pageRows.map((row, index) => textLine(row, 48, 725 - index * 16, row.startsWith("TOTAL") ? 12 : 9)),
      textLine(input.footer ?? "Documento interno generado por KHORA", 48, 42, 8),
      textLine(`Pagina ${pageIndex + 1} de ${pages.length}`, 500, 42, 8),
    ].join("\n");
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = new TextEncoder().encode(pdf).length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
