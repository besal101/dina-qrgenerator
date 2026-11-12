"use client";

import { useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";

import fontkit from "@pdf-lib/fontkit";
import { Poppins } from "next/font/google";

const poppins = Poppins({ weight: ["400", "700"], subsets: ["latin"] });

// Square label modelled on the reference card: Poppins text block top-left, dotted QR below.
const P = 282.96; // 10 cm
const BG = rgb(0.9647, 0.9373, 0.8863);
const FG = rgb(0.2, 0.3059, 0.2627);
// R: wider right margin than left so lines wrap early; GAP: space between text groups.
const LH = 0.056 * P;
const NAME_FS = 0.075 * P; // brand name, much larger than body text
const R = 0.2 * P, GAP = 0.6 * LH, X = 0.107 * P, FS = 0.042 * P, TOP = 0.13 * P, QR_TOP = 0.55 * P, QR_SIZE = 0.4 * P, BOTTOM = 0.07 * P;

type Fields = { title: string; material: string; top: string; bottom: string; height: string; link: string };
// Top x Bottom x Height, in cm.
// Empty parts are skipped; no line at all when every part is empty.
const sizeLine = (f: Fields) => {
  const parts = [f.top, f.bottom, f.height].map((v) => v.trim()).filter(Boolean);
  return parts.length ? `Size: ${parts.map((v) => `${v} cm`).join(" x ")}` : "";
};

// QR as shapes in module units: square finder eyes, round dots for everything else.
function qrShapes(link: string) {
  const qr = QRCode.create(link, { errorCorrectionLevel: "M" }).modules;
  const n = qr.size;
  const eye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const dots: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.get(r, c) && !eye(r, c)) dots.push([r, c]);
  return { n, dots, eyes: [[0, 0], [0, n - 7], [n - 7, 0]] as [number, number][] };
}

async function buildPdf(f: Fields) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const load = async (w: string) => pdf.embedFont(await (await fetch(`/fonts/Poppins-${w}.ttf`)).arrayBuffer());
  const [font, bold] = await Promise.all([load("Regular"), load("Bold")]);
  const page = pdf.addPage([P, P]);
  page.drawRectangle({ x: 0, y: 0, width: P, height: P, color: BG });

  // Word-wrap to the text column (left margin X, right margin R).
  const wrap = (t: string, fnt = font) => {
    const out: string[] = [];
    let line = "";
    for (const w of t.split(" ")) {
      const next = line ? `${line} ${w}` : w;
      if (line && fnt.widthOfTextAtSize(next, FS) > P - X - R) {
        out.push(line);
        line = w;
      } else line = next;
    }
    return [...out, line];
  };
  page.drawText("DINA-SUE", { x: X, y: P - TOP, size: NAME_FS, font: bold, color: FG });

  // Groups below the name: title | details, with GAP before each group.
  const groups = [[f.title], [`Material: ${f.material}`, sizeLine(f)].filter(Boolean)];
  let y = TOP + LH;
  for (const texts of groups) {
    y += GAP;
    for (const l of texts.flatMap((t) => wrap(t))) {
      page.drawText(l, { x: X, y: P - y, size: FS, font, color: FG });
      y += LH;
    }
  }

  // QR sits at the reference position unless the text runs long; always a clear gap below the text.
  const top = Math.max(QR_TOP, y + GAP);
  const size = Math.min(QR_SIZE, P - top - BOTTOM);
  const { n, dots, eyes } = qrShapes(f.link);
  const m = size / n;
  const at = (r: number, c: number, h: number) => ({ x: X + c * m, y: P - top - r * m - h });
  for (const [r, c] of dots) page.drawCircle({ ...at(r + 0.5, c + 0.5, 0), size: m * 0.42, color: FG });
  for (const [r, c] of eyes) {
    page.drawRectangle({ ...at(r + 0.5, c + 0.5, 6 * m), width: 6 * m, height: 6 * m, borderColor: FG, borderWidth: m });
    page.drawRectangle({ ...at(r + 2, c + 2, 3 * m), width: 3 * m, height: 3 * m, color: FG });
  }
  return pdf.save();
}

function QrPreview({ link }: { link: string }) {
  const { n, dots, eyes } = qrShapes(link || " ");
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-full w-full" fill="currentColor">
      {dots.map(([r, c]) => <circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={0.42} />)}
      {eyes.map(([r, c]) => (
        <g key={`e${r}-${c}`}>
          <rect x={c + 0.5} y={r + 0.5} width={6} height={6} fill="none" stroke="currentColor" strokeWidth={1} />
          <rect x={c + 2} y={r + 2} width={3} height={3} />
        </g>
      ))}
    </svg>
  );
}

export default function Home() {
  const [f, setF] = useState({
    title: "Golden Hour",
    material: "Hand-built white stoneware with layered glazes.",
    top: "27",
    bottom: "19",
    height: "42",
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
            <label className={label}>Title<input className={input} value={f.title} onChange={set("title")} required /></label>
            <label className={label}>Material<input className={input} value={f.material} onChange={set("material")} required /></label>
            <fieldset>
              <legend className={label}>Size (cm)</legend>
              <div className="grid grid-cols-3 gap-3">
                <label className={label}>Diameter top<input className={input} inputMode="decimal" value={f.top} onChange={set("top")} /></label>
                <label className={label}>Diameter bottom<input className={input} inputMode="decimal" value={f.bottom} onChange={set("bottom")} /></label>
                <label className={label}>Height<input className={input} inputMode="decimal" value={f.height} onChange={set("height")} /></label>
              </div>
              <span className="mt-1 block text-xs font-normal text-stone-500">Shown as &quot;Size: top x bottom x height&quot;. &quot;cm&quot; is added automatically; leave a box empty to skip it.</span>
            </fieldset>
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
            <div className={`${poppins.className} aspect-square w-full max-w-[378px] shadow-lg`} style={{ background: "#F6EFE2", color: "#344E43", containerType: "inline-size" }}>
              <div className="flex h-full w-full flex-col pb-[7%] pl-[10.7%] pr-[20%] pt-[9.3%]" style={{ fontSize: "4.2cqw", lineHeight: 1.33 }}>
                <div className="font-bold leading-none" style={{ fontSize: "1.79em" }}>DINA-SUE</div>
                <div className="mt-[0.77em]">{f.title}</div>
                <div className="mt-[0.77em]">Material: {f.material}</div>
                {sizeLine(f) && <div>{sizeLine(f)}</div>}
                <div className="min-h-[1.5em] flex-1" />
                <div className="aspect-square w-[40%] min-h-0 shrink">
                  <QrPreview link={f.link} />
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-stone-500">Approximate preview.</p>
        </section>
      </main>
    </div>
  );
}
