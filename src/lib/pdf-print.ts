// Utilitário central de impressão do SIGMO.
// Evita window.open()/autoPrint(), que em iframe/sandbox costuma gerar folha em branco.
type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === "undefined") throw new Error("pdfjs only available in browser");
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      // @ts-ignore
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return pdfjsPromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[c] ?? c));
}

async function toArrayBuffer(input: ArrayBuffer | Uint8Array | Blob): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return input.slice(0);
  if (input instanceof Uint8Array) {
    const copy = new ArrayBuffer(input.byteLength);
    new Uint8Array(copy).set(input);
    return copy;
  }
  if (typeof Blob !== "undefined" && input instanceof Blob) return input.arrayBuffer();
  throw new Error("Formato de PDF não suportado para impressão");
}

export async function renderPdfToImagePages(input: ArrayBuffer | Uint8Array | Blob, scale = 3): Promise<string[]> {
  const buf = await toArrayBuffer(input);
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas indisponível para impressão");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas, background: "#ffffff", intent: "print" }).promise;
    pages.push(canvas.toDataURL("image/png"));
  }

  return pages;
}

export async function renderPdfToImagePagesProgressive(
  input: ArrayBuffer | Uint8Array | Blob,
  onPage: (pageDataUrl: string, pageNumber: number, totalPages: number) => void,
  scale = 2,
): Promise<string[]> {
  const buf = await toArrayBuffer(input);
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas indisponível para visualização");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas, background: "#ffffff" }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    pages.push(dataUrl);
    onPage(dataUrl, i, pdf.numPages);
  }

  return pages;
}

async function measureFirstPage(src: string): Promise<{ orientation: "portrait" | "landscape" }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ orientation: img.naturalWidth > img.naturalHeight ? "landscape" : "portrait" });
    img.onerror = () => resolve({ orientation: "portrait" });
    img.src = src;
  });
}

async function waitImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  }));
}

export async function printImagePages(pages: string[], fileName = "documento.pdf") {
  if (!pages.length) return;
  const { orientation } = await measureFirstPage(pages[0]);
  const pageSize = orientation === "landscape" ? "297mm 210mm" : "210mm 297mm";
  const pageClass = orientation === "landscape" ? "sigmo-print-page landscape" : "sigmo-print-page";
  const safeTitle = escapeHtml(fileName);

  // Imprime em um documento HTML isolado. Alterar o DOM principal durante a
  // impressão conflita com portais/modais e estilos globais do app em alguns
  // navegadores, produzindo página branca. O iframe contém somente as folhas.
  document.querySelectorAll("iframe.sigmo-image-print-frame").forEach((el) => el.remove());
  const iframe = document.createElement("iframe");
  iframe.className = "sigmo-image-print-frame";
  iframe.title = `Impressão de ${fileName}`;
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-320mm",
    top: "0",
    width: orientation === "landscape" ? "297mm" : "210mm",
    height: orientation === "landscape" ? "210mm" : "297mm",
    border: "0",
    background: "white",
    pointerEvents: "none",
  } as CSSStyleDeclaration);
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDoc || !frameWindow) {
    iframe.remove();
    throw new Error("Navegador não permitiu preparar a área de impressão");
  }

  const sheets = pages.map((src, index) => (
    `<section class="${pageClass}" data-page="${index + 1}"><img src="${src}" alt="${safeTitle} - página ${index + 1}"></section>`
  )).join("");
  frameDoc.open();
  frameDoc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    @page { size: ${pageSize}; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    .sigmo-print-page {
      width: 210mm; height: 297mm; margin: 0; padding: 0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #fff; break-after: page; page-break-after: always;
    }
    .sigmo-print-page.landscape { width: 297mm; height: 210mm; }
    .sigmo-print-page:last-child { break-after: auto; page-break-after: auto; }
    img {
      display: block; width: 100%; height: 100%; object-fit: contain;
      margin: 0; padding: 0; border: 0; background: #fff; opacity: 1;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
  </style></head><body>${sheets}</body></html>`);
  frameDoc.close();

  await waitImages(frameDoc.body);
  const images = Array.from(frameDoc.images);
  await Promise.all(images.map((img) => typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  frameWindow.focus();
  frameWindow.print();
  window.setTimeout(cleanup, 120000);
}

export async function printPdf(input: ArrayBuffer | Uint8Array | Blob, fileName = "documento.pdf") {
  // 1) Tenta impressão nativa via iframe (vetor — texto preto sólido, sem
  // rasterização). Funciona no Chrome/Edge/Firefox com PDF viewer integrado.
  try {
    await printPdfNative(input, fileName);
    return;
  } catch (e) {
    console.warn("[printPdf] nativo falhou, caindo para fallback raster:", e);
  }
  // 2) Fallback: rasteriza com pdf.js (último recurso — pode sair acinzentado).
  const pages = await renderPdfToImagePages(input);
  await printImagePages(pages, fileName);
}

async function printPdfNative(input: ArrayBuffer | Uint8Array | Blob, fileName: string): Promise<void> {
  let blob: Blob;
  if (input instanceof Blob) {
    blob = input;
  } else {
    const buf = await toArrayBuffer(input);
    blob = new Blob([buf], { type: "application/pdf" });
  }
  const url = URL.createObjectURL(blob);

  return await new Promise<void>((resolve, reject) => {
    document.querySelectorAll("iframe.sigmo-print-iframe").forEach((el) => el.remove());

    const iframe = document.createElement("iframe");
    iframe.className = "sigmo-print-iframe";
    iframe.title = fileName;
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("afterprint", onAfter);
      setTimeout(() => {
        try { iframe.remove(); } catch {}
        URL.revokeObjectURL(url);
      }, 1500);
    };
    const onAfter = () => { if (!settled) { settled = true; cleanup(); resolve(); } };

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Tempo esgotado aguardando viewer de PDF"));
    }, 8000);

    iframe.onload = () => {
      // Dá um respiro pro viewer interno do navegador montar o PDF antes do print.
      window.setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) throw new Error("iframe sem contentWindow");
          window.clearTimeout(timeout);
          window.addEventListener("afterprint", onAfter, { once: true });
          win.focus();
          win.print();
          // Fallback: alguns navegadores não disparam afterprint para iframes.
          window.setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve(); } }, 60000);
        } catch (e) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          cleanup();
          reject(e as Error);
        }
      }, 350);
    };
    iframe.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("Falha ao carregar PDF no iframe"));
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

export async function printHtmlContent(html: string, title = "documento", extraCss = "") {
  const previousTitle = document.title;
  document.querySelectorAll(".sigmo-print-html-root, #sigmo-print-html-style").forEach((el) => el.remove());

  const style = document.createElement("style");
  style.id = "sigmo-print-html-style";
  style.textContent = `
    @media screen {
      .sigmo-print-html-root {
        position: fixed !important;
        left: -100000px !important;
        top: 0 !important;
        width: 210mm !important;
        background: #fff !important;
        color: #0f172a !important;
      }
    }
    @media print {
      @page { size: A4; margin: 12mm; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: auto !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        background: #fff !important;
      }
      body > *:not(.sigmo-print-html-root) { display: none !important; }
      .sigmo-print-html-root {
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #0f172a !important;
      }
      ${extraCss}
    }
  `;

  const root = document.createElement("div");
  root.className = "sigmo-print-html-root";
  root.innerHTML = html;

  const cleanup = () => {
    document.title = previousTitle;
    root.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  document.head.appendChild(style);
  document.body.appendChild(root);
  document.title = title;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  window.addEventListener("afterprint", cleanup, { once: true });
  window.focus();
  window.print();
  window.setTimeout(cleanup, 120000);
}