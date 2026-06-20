# OCR separat pentru specificatii scanate

Aceasta pagina descrie fluxul adaugat in aplicatie pentru documente scanate.

Ruta: `/admin/licitatii/importa/ocr`

Flux:

1. incarci PDF scanat sau imagine;
2. OCR-ul ruleaza in browser;
3. verifici si corectezi textul extras;
4. creezi proiectul de licitatie din textul verificat.

Implementarea foloseste `pdfjs-dist` pentru randarea paginilor PDF in canvas si `tesseract.js` pentru recunoastere text `ron+eng`.
