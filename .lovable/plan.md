# Plan: CNPJ Card Logic Review and Fixes

Review and optimize the logic for "Cartão CNPJ (PDF — evidência documental)" upload, addressing inconsistencies, edge cases, and failure modes in data extraction and auto-filling.

## User Review Required

> [!IMPORTANT]
> This feature depends on third-party APIs (BrasilAPI) and browser-based OCR (Tesseract.js). If these fail, the system falls back to manual input or "Consultar Receita" button.

- Do you prefer a specific retry strategy if the API is slow?
- Should the system block the save if the CNPJ extracted from the PDF differs from what's already typed?

## Proposed Changes

### Core Logic (`src/lib/brasilapi-cnpj.ts`)

- **Improve Regex for CNPJ extraction**: Make it even more robust against broken text lines common in PDFs (e.g., text splitting across divs).
- **Add Validation**: Ensure the extracted CNPJ checksum is valid before proceeding to API calls.
- **Normalize Output**: Ensure all fields (UF, CEP, phone) follow a strict format.

### Frontend Component (`src/routes/app.companies.tsx`)

- **Fix Race Conditions**: Ensure that if a user uploads a PDF while another action is pending, states don't conflict.
- **Enhanced OCR Feedback**: Provide clearer progress updates during the "PDF -> Image -> Tesseract" flow.
- **Data Merging Logic**: Refine how we decide to overwrite existing fields (preserve user changes vs. Receita data).
- **Error Handling**: Catch specific "pdfjs-dist" loading errors or Tesseract initialization failures gracefully.

### UI/UX Adjustments

- Add a "Visualizar" button next to the upload field for immediate verification.
- Improve the loader states specifically for the "Reading Document..." phase.

## Technical Details

- Use `pdfjs-dist` version checks for consistency.
- Implement a checksum validator for CNPJ (MOD11).
- Add `try-catch` blocks around dynamic imports of heavy libraries (`tesseract.js`, `pdfjs-dist`) to prevent total component crashes.

