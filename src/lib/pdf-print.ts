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
  const previousTitle = document.title;
  const safeTitle = escapeHtml(fileName);

  document.querySelectorAll(".sigmo-print-root, #sigmo-print-style").forEach((el) => el.remove());

  const style = document.createElement("style");
  style.id = "sigmo-print-style";
  style.textContent = `
    @media screen {
      .sigmo-print-root {
        position: fixed !important;
        left: -100000px !important;
        top: 0 !important;
        width: ${orientation === "landscape" ? "297mm" : "210mm"} !important;
        min-height: ${orientation === "landscape" ? "210mm" : "297mm"} !important;
        overflow: hidden !important;
        pointer-events: none !important;
        background: #fff !important;
      }
    }
    @media print {
      @page { size: ${pageSize}; margin: 0; }
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
      body > *:not(.sigmo-print-root) { display: none !important; }
      .sigmo-print-root {
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .sigmo-print-page {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        break-after: page;
        page-break-after: always;
        background: #fff !important;
      }
      .sigmo-print-page.landscape {
        width: 297mm !important;
        height: 210mm !important;
      }
      .sigmo-print-page:last-child { break-after: auto; page-break-after: auto; }
      .sigmo-print-page img {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        background: #fff !important;
      }
    }
  `;

  const root = document.createElement("div");
  root.className = "sigmo-print-root";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = pages.map((src, index) => (
    `<section class="${pageClass}" data-page="${index + 1}"><img src="${src}" alt="${safeTitle} - página ${index + 1}" /></section>`
  )).join("");

  const cleanup = () => {
    document.title = previousTitle;
    root.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  document.head.appendChild(style);
  document.body.appendChild(root);
  document.title = fileName;
  await waitImages(root);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  window.addEventListener("afterprint", cleanup, { once: true });
  window.focus();
  window.print();
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