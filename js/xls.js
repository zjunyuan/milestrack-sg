// Minimal reader for old Excel (.xls, BIFF8 in an OLE2 container), enough for bank transaction exports:
// text and number cells of the first worksheet, dates shown as "DD Mon YYYY". No libraries, and the file never leaves the device.
// Returns an array of rows (arrays of strings), like parseCsv does for CSV text.

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function readOle(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  if (u8.length < 512 || sig.some((b, i) => u8[i] !== b)) throw new Error("Not an .xls file");
  const secSize = 1 << dv.getUint16(0x1E, true), miniSize = 1 << dv.getUint16(0x20, true);
  const dirStart = dv.getUint32(0x30, true), cutoff = dv.getUint32(0x38, true);
  const miniFatStart = dv.getUint32(0x3C, true), difatStart = dv.getUint32(0x44, true), difatCount = dv.getUint32(0x48, true);
  const sec = (n) => u8.subarray((n + 1) * secSize, (n + 2) * secSize);
  const END = 0xFFFFFFFE;
  const difat = [];
  for (let i = 0; i < 109; i++) { const v = dv.getUint32(0x4C + i * 4, true); if (v < END) difat.push(v); }
  let nextD = difatStart;
  for (let d = 0; d < difatCount && nextD < END; d++) {
    const s = sec(nextD), sv = new DataView(s.buffer, s.byteOffset, s.byteLength);
    for (let i = 0; i < secSize / 4 - 1; i++) { const v = sv.getUint32(i * 4, true); if (v < END) difat.push(v); }
    nextD = sv.getUint32(secSize - 4, true);
  }
  const fat = [];
  for (const f of difat) { const s = sec(f), sv = new DataView(s.buffer, s.byteOffset, s.byteLength); for (let i = 0; i < secSize / 4; i++) fat.push(sv.getUint32(i * 4, true)); }
  const chain = (start, table) => { const out = []; let n = start, guard = 0; while (n < END && guard++ < 1e6) { out.push(n); n = table[n]; } return out; };
  const readChain = (start) => { const parts = chain(start, fat).map(sec); const out = new Uint8Array(parts.length * secSize); parts.forEach((p, i) => out.set(p, i * secSize)); return out; };
  const dir = readChain(dirStart), dd = new DataView(dir.buffer);
  const entries = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nameLen = dd.getUint16(o + 0x40, true);
    if (!nameLen) continue;
    let name = ""; for (let i = 0; i < nameLen / 2 - 1; i++) name += String.fromCharCode(dd.getUint16(o + i * 2, true));
    entries.push({ name, type: dir[o + 0x42], start: dd.getUint32(o + 0x74, true), size: dd.getUint32(o + 0x78, true) });
  }
  const root = entries.find(e => e.type === 5);
  const stream = entries.find(e => e.type === 2 && /^(Workbook|Book)$/i.test(e.name));
  if (!stream) throw new Error("No workbook found in the file");
  if (stream.size >= cutoff) return readChain(stream.start).subarray(0, stream.size);
  // small streams live in the mini stream
  const miniStream = readChain(root.start);
  const miniFatBytes = readChain(miniFatStart), mv = new DataView(miniFatBytes.buffer);
  const miniFat = []; for (let i = 0; i < miniFatBytes.length / 4; i++) miniFat.push(mv.getUint32(i * 4, true));
  const parts = chain(stream.start, miniFat).map(n => miniStream.subarray(n * miniSize, (n + 1) * miniSize));
  const out = new Uint8Array(parts.length * miniSize); parts.forEach((p, i) => out.set(p, i * miniSize));
  return out.subarray(0, stream.size);
}

function decodeRk(rk) {
  let v;
  if (rk & 2) v = rk >> 2;
  else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, rk & 0xFFFFFFFC, true); v = b.getFloat64(0, true); }
  return rk & 1 ? v / 100 : v;
}

const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const isDateFormat = (code) => /[dmyhs]/i.test(String(code).replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""));
function serialToDate(n, mode1904) {
  const ms = Math.round((n - (mode1904 ? 24107 : (n < 61 ? 25568 : 25569))) * 86400000);
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const numStr = (v) => String(Math.round(v * 1e8) / 1e8);

export function readXls(arrayBuffer) {
  const wb = readOle(arrayBuffer);
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  // split into records, merging CONTINUE (0x3C) into the record it continues
  const recs = [];
  for (let o = 0; o + 4 <= wb.length;) {
    const id = dv.getUint16(o, true), len = dv.getUint16(o + 2, true);
    const data = wb.subarray(o + 4, o + 4 + len);
    if (id === 0x3C && recs.length) recs[recs.length - 1].parts.push(data); else recs.push({ id, parts: [data] });
    o += 4 + len;
  }
  const sst = [], xfFmt = [], formats = {};
  let mode1904 = false, sheetIdx = -1;
  const cells = new Map();   // "r,c" -> string
  let maxR = -1, maxC = -1;
  const put = (r, c, v) => { cells.set(r + "," + c, v); if (r > maxR) maxR = r; if (c > maxC) maxC = c; };

  const parseSst = (parts) => {
    // Strings can run across the boundary between parts; a continued string repeats its 1-byte "wide" flag.
    let pi = 0, p = 0;
    const cur = () => parts[pi], dvOf = (a) => new DataView(a.buffer, a.byteOffset, a.byteLength);
    const need = (n) => { while (pi < parts.length && p + n > parts[pi].length && p >= parts[pi].length) { pi++; p = 0; } };
    const u8 = () => { need(1); return cur()[p++]; };
    const u16 = () => { const a = u8(), b = u8(); return a | (b << 8); };
    const u32 = () => (u16() | (u16() << 16)) >>> 0;
    p = 8;                                          // skip total/unique counts
    const unique = dvOf(parts[0]).getUint32(4, true);
    for (let s = 0; s < unique && pi < parts.length; s++) {
      if (p >= cur().length && pi + 1 < parts.length) { pi++; p = 0; }
      const cch = u16(), flags = u8();
      let wide = flags & 1, runs = 0, ext = 0;
      if (flags & 8) runs = u16();
      if (flags & 4) ext = u32();
      let str = "";
      for (let i = 0; i < cch; i++) {
        if (p >= cur().length && pi + 1 < parts.length) { pi++; p = 0; wide = cur()[p++] & 1; }   // continuation: new flag byte
        if (wide) { const a = cur()[p++], b = cur()[p++]; str += String.fromCharCode(a | (b << 8)); }
        else str += String.fromCharCode(cur()[p++]);
      }
      const skip = runs * 4 + ext;
      for (let k = 0; k < skip; k++) { if (p >= cur().length && pi + 1 < parts.length) { pi++; p = 0; } p++; }
      sst.push(str);
    }
  };

  const join = (parts) => { if (parts.length === 1) return parts[0]; const n = parts.reduce((a, b) => a + b.length, 0), out = new Uint8Array(n); let o = 0; for (const x of parts) { out.set(x, o); o += x.length; } return out; };
  const fmtValue = (xf, v) => {
    const f = xfFmt[xf];
    if (f !== undefined && (BUILTIN_DATE_FMT.has(f) || (formats[f] && isDateFormat(formats[f])))) return serialToDate(v, mode1904);
    return numStr(v);
  };
  for (const rec of recs) {
    if (rec.id === 0x809) { sheetIdx++; continue; }               // BOF: 0 = globals, 1 = first worksheet
    if (rec.id === 0xFC) { parseSst(rec.parts); continue; }
    const d = join(rec.parts), v = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (rec.id === 0x22) mode1904 = v.getUint16(0, true) === 1;
    else if (rec.id === 0xE0) xfFmt.push(v.getUint16(2, true));
    else if (rec.id === 0x41E) {
      const idx = v.getUint16(0, true), cch = v.getUint16(2, true), fl = d[4] & 1;
      let s = ""; for (let i = 0; i < cch; i++) s += fl ? String.fromCharCode(v.getUint16(5 + i * 2, true)) : String.fromCharCode(d[5 + i]);
      formats[idx] = s;
    } else if (sheetIdx === 1) {
      if (rec.id === 0xFD) put(v.getUint16(0, true), v.getUint16(2, true), sst[v.getUint32(6, true)] ?? "");
      else if (rec.id === 0x203) put(v.getUint16(0, true), v.getUint16(2, true), fmtValue(v.getUint16(4, true), v.getFloat64(6, true)));
      else if (rec.id === 0x27E) put(v.getUint16(0, true), v.getUint16(2, true), fmtValue(v.getUint16(4, true), decodeRk(v.getUint32(6, true))));
      else if (rec.id === 0xBD) {
        const r = v.getUint16(0, true), c0 = v.getUint16(2, true), n = (d.length - 6) / 6;
        for (let i = 0; i < n; i++) put(r, c0 + i, fmtValue(v.getUint16(4 + i * 6, true), decodeRk(v.getUint32(6 + i * 6, true))));
      } else if (rec.id === 0x204) {
        const cch = v.getUint16(6, true); let s = "";
        if (d[8] <= 1 && 9 + cch <= d.length + 1) { const wide = d[8] & 1; for (let i = 0; i < cch; i++) s += wide ? String.fromCharCode(v.getUint16(9 + i * 2, true)) : String.fromCharCode(d[9 + i]); }
        else for (let i = 0; i < cch; i++) s += String.fromCharCode(d[8 + i]);
        put(v.getUint16(0, true), v.getUint16(2, true), s);
      }
    }
  }
  const rows = [];
  for (let r = 0; r <= maxR; r++) { const row = []; for (let c = 0; c <= maxC; c++) row.push((cells.get(r + "," + c) ?? "").trim()); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ""));
}
