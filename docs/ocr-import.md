# OCR separat pentru specificatii scanate

Flux recomandat:

1. Intra in `/admin/licitatii/importa/ocr`.
2. Incarca PDF-ul scanat sau imaginile documentului.
3. Ruleaza OCR.
4. Corecteaza textul extras in textarea.
5. Creeaza licitatia din textul verificat.

OCR-ul ruleaza in browser cu `pdfjs-dist` pentru randarea paginilor PDF si `tesseract.js` pentru recunoasterea textului in romana si engleza (`ron+eng`). Am ales aceasta varianta pentru a evita dependinte native de tip poppler/canvas pe server, care sunt fragile in deploy serverless.

Limitari:

- PDF-urile foarte mari pot dura mult. Creste gradual numarul maxim de pagini.
- OCR-ul depinde de calitatea scanarii.
- Textul extras trebuie verificat manual inainte de generarea licitatiei.
