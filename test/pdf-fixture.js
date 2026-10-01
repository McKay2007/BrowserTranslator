// Small, deterministic PDF with mixed fonts, adjacent text runs, a rotated page
// and an image-only/blank page. No dependency or remote PDF is needed.
(function (root) {
  function makePdfFixture() {
    const streams = [
      'BT /F1 18 Tf 1 0 0 1 60 740 Tm (Hello world.) Tj ' +
      '/F2 12 Tf 1 0 0 1 60 690 Tm (ReadMate PDF selection.) Tj ' +
      '1 0 0 1 60 674 Tm (Second line of the same paragraph.) Tj ' +
      '1 0 0 1 60 630 Tm (New paragraph.) Tj ' +
      '/F1 16 Tf 1 0 0 1 60 570 Tm (inter) Tj (national) Tj ' +
      '1 0 0 1 60 540 Tm (left) Tj 35 0 Td (right) Tj ' +
      '1 0 0 1 60 490 Tm (translation.) Tj ' +
      '1 0 0 1 60 460 Tm (translati) Tj /F2 16 Tf (on) Tj ' +
      '/F3 16 Tf 1 0 0 1 60 430 Tm (translation) Tj ET',
      'BT /F1 18 Tf 1 0 0 1 60 740 Tm (Rotated page.) Tj ET',
      '0.9 g 40 40 500 700 re f'
    ];
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Count 3 /Kids [3 0 R 4 0 R 5 0 R] >>',
      ...streams.map((_, i) => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
        (i === 1 ? '/Rotate 90 ' : '') +
        '/Resources << /Font << /F1 6 0 R /F2 7 0 R /F3 8 0 R >> >> /Contents ' + (9 + i) + ' 0 R >>'),
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>',
      ...streams.map(stream => '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream')
    ];
    let pdf = '%PDF-1.7\n';
    const offsets = [0];
    objects.forEach((object, i) => {
      offsets.push(pdf.length);
      pdf += (i + 1) + ' 0 obj\n' + object + '\nendobj\n';
    });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
    pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return new TextEncoder().encode(pdf);
  }
  root.makePdfFixture = makePdfFixture;
})(typeof window === 'undefined' ? module.exports : window);
