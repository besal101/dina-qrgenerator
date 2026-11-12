"use client";

import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

// Layout measured from "Golden Hour label.pdf": 378px design grid, 282.96pt page.
const S = 282.96 / 378;
const BG = rgb(0.9647, 0.9373, 0.8863);
const FG = rgb(0.2, 0.3059, 0.2627);

async function buildPdf(f: { subtitle: string; title: string; size: string; link: string }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([282.96, 282.96]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 0, width: 282.96, height: 282.96, color: BG });

  const text = (t: string, y: number, size: number) =>
    page.drawText(t, { x: 34.0156 * S, y: 282.96 - y * S, size: size * S, font, color: FG });

  text(f.subtitle, 38.55, 15.12);
  text(f.title, 62.73, 18.14);
  text("Material: Hand-built white stoneware", 93.36, 12.85);
  text("with layered glazes.", 108.53, 12.85);
  const lines = f.size.split("\n").filter((l) => l.trim());
  lines.forEach((l, i) => text(i === 0 ? `Size: ${l}` : l, 128.14 + i * 15.17, 12.85));
  text("Scan to view piece", 354.56, 6.8);

  const logo = await pdf.embedPng(await (await fetch("/dinasuelogo.png")).arrayBuffer());
  page.drawImage(logo, { x: 292.66 * S, y: 282.96 - (23.46 + 51.08) * S, width: 51.68 * S, height: 51.08 * S });

  // QR: 113.4px box at (34, 230.6) with ~3px quiet margin, modules drawn as vector squares.
  const qr = QRCode.create(f.link, { errorCorrectionLevel: "M" }).modules;
  const n = qr.size, box = 107.7, m = box / n, x0 = 37.1, y0 = 233.7;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.get(r, c))
        page.drawRectangle({
          x: (x0 + c * m) * S,
          y: 282.96 - (y0 + (r + 1) * m) * S,
          width: m * S + 0.05,
          height: m * S + 0.05,
          color: FG,
        });

  return pdf.save();
}

export default function Home() {
  const [f, setF] = useState({
    subtitle: "Color Unbound 2026",
    title: "Golden Hour",
    size: "Diameter Top: 27cm\nDiameter Bottom: 19cm\nHeight: 42cm",
    link: "https://",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function generate() {
    setBusy(true);
    try {
      const bytes = await buildPdf(f);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${f.title || "label"} label.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-[#344E43] focus:ring-2 focus:ring-[#344E43]/20";
  const label = "block text-sm font-medium text-stone-700";
  const sizeLines = f.size.split("\n").filter((l) => l.trim());

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dinasuelogo.png" alt="Dina-Sue" className="h-9 w-9 object-contain" />
          <span className="text-sm font-semibold tracking-wide text-stone-800">Dina-Sue · Label Generator</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-2">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Create a piece label</h1>
          <p className="mt-1 text-sm text-stone-500">Fill in the details and download a print-ready 10 × 10 cm PDF with QR code.</p>
          <form
            className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <label className={label}>Subtitle<input className={input} value={f.subtitle} onChange={set("subtitle")} required /></label>
            <label className={label}>Title<input className={input} value={f.title} onChange={set("title")} required /></label>
            <label className={label}>
              Size
              <textarea className={input} rows={3} value={f.size} onChange={set("size")} />
              <span className="mt-1 block text-xs font-normal text-stone-500">One measurement per line. &quot;Size:&quot; is added automatically.</span>
            </label>
            <label className={label}>Website link<input className={input} type="url" placeholder="https://" value={f.link} onChange={set("link")} required /></label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#344E43] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a4036] focus:outline-none focus:ring-2 focus:ring-[#344E43]/40 disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate & download PDF"}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-medium text-stone-500 lg:mt-1.5">Preview</h2>
          <div className="mt-[2.1rem] flex justify-center rounded-2xl border border-stone-200 bg-stone-100 p-6">
            <div className="aspect-square w-full max-w-[378px] shadow-lg" style={{ background: "#F6EFE2", color: "#344E43", containerType: "inline-size" }}>
              <div className="relative h-full w-full" style={{ fontSize: "3.4cqw" }}>
                <div className="absolute left-[9%] top-[6.5%] w-[62%] leading-tight">
                  <div style={{ fontSize: "1.18em" }}>{f.subtitle}</div>
                  <div style={{ fontSize: "1.41em" }} className="mt-[0.2em]">{f.title}</div>
                  <div className="mt-[1.3em]">Material: Hand-built white stoneware with layered glazes.</div>
                  <div className="mt-[0.8em]">
                    {sizeLines.map((l, i) => <div key={i}>{i === 0 ? `Size: ${l}` : l}</div>)}
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/dinasuelogo.png" alt="" className="absolute" style={{ left: "77.4%", top: "6.2%", width: "13.7%" }} />
                <div className="absolute left-[9%] top-[61%] aspect-square w-[30%] border-2 border-dashed border-[#344E43]/40" />
                <div className="absolute left-[9%] top-[94%] text-[0.6em]">Scan to view piece</div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-stone-500">Approximate preview. The QR code is generated in the PDF.</p>
        </section>
      </main>
    </div>
  );
}
