#!/usr/bin/env python3
"""
Redact card details from bank statement CSVs, and turn text-based PDF statements into CSV.

Usage:
    python redact_statements.py FILE [FILE ...] [--out FOLDER] [--password PW] [--keep-names]

  .csv  -> <name>_redacted.csv   card/account numbers masked to the last 4 digits, NRIC, emails, phone numbers and
                                 (unless --keep-names) name/address lines in the header block removed
  .pdf  -> <name>_redacted.csv   transactions turned into Date, Posting Date, Description, Amount rows
                                 (the same shape MilesTrack's importer reads), with the same masking applied

Nothing is uploaded; everything runs on this computer. Originals are never changed.
PDF support needs:  pip install pdfplumber     (or pypdf; scanned/image PDFs have no text and cannot be read)
"""
import argparse, csv, io, os, re, sys

# ---------------------------------------------------------------- masking
CARD_RE = re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])")           # 13-19 digits, optionally spaced/dashed
MASKED_RE = re.compile(r"(?:[X•*xX]{4}[ -]){2,3}[X•*xX]{0,4}\d{4}")      # already masked: leave alone
LONGNUM_RE = re.compile(r"(?<![\d.,])\d{9,12}(?![\d.,])")                  # account / reference-like numbers
NRIC_RE = re.compile(r"\b[STFGM]\d{7}[A-Z]\b", re.I)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?65[ -]?)?[689]\d{3}[ -]?\d{4}(?!\d)")
PERSONAL_LABEL_RE = re.compile(r"\b(name|address|nric|passport|email|e-mail|mobile|phone|contact|postal|blk|block)\b", re.I)


def mask_card(m):
    digits = re.sub(r"\D", "", m.group(0))
    return "XXXX-XXXX-XXXX-" + digits[-4:] if len(digits) >= 13 else m.group(0)


def mask_text(s, longnums=True):
    if not s:
        return s
    s = CARD_RE.sub(mask_card, s)
    if longnums:
        s = LONGNUM_RE.sub(lambda m: "X" * (len(m.group(0)) - 4) + m.group(0)[-4:], s)
    s = NRIC_RE.sub("XXXXXXXXX", s)
    s = EMAIL_RE.sub("[email removed]", s)
    return s


def looks_like_date(s):
    return bool(re.match(r"^\s*\d{1,2}[ /.-](?:\d{1,2}|[A-Za-z]{3,4})[ /.-]\d{2,4}\s*$", s or ""))


def redact_rows(rows, keep_names=False):
    """Rows before the first transaction line are the header block (name, address, card number...)."""
    first_tx = next((i for i, r in enumerate(rows) if r and looks_like_date(r[0]) or any(looks_like_date(c) for c in r[:2])), len(rows))
    # a column header row just above the first transaction must survive
    keep_from = first_tx
    if first_tx > 0 and rows[first_tx - 1] and re.search(r"date|description|amount|debit|credit|transaction", " ".join(rows[first_tx - 1]), re.I):
        keep_from = first_tx - 1
    out = []
    for i, r in enumerate(rows):
        r = list(r)
        if i < keep_from and not keep_names:
            line = " ".join(r)
            if PERSONAL_LABEL_RE.search(line) or PHONE_RE.search(line):
                # keep the label, drop the value:  "Name:,JOHN TAN"  ->  "Name:,[removed]"
                r = [c for c in r[:1]] + ["[removed]"] if len(r) > 1 else ["[removed]"]
        r = [mask_text(c, longnums=(i >= keep_from)) if i >= keep_from else mask_text(c, longnums=False) for c in r]
        if i >= keep_from:
            r = [PHONE_RE.sub("[phone removed]", c) if not looks_like_date(c) and not re.fullmatch(r"-?[\d,]+\.\d{2}", c.strip()) else c for c in r]
        out.append(r)
    return out


def read_csv_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def do_csv(path, outdir, keep_names):
    text = read_csv_text(path)
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    rows = redact_rows(rows, keep_names)
    out = os.path.join(outdir, os.path.splitext(os.path.basename(path))[0] + "_redacted.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    return out, len(rows)


# ---------------------------------------------------------------- PDF -> CSV
MONTHS = {m: i + 1 for i, m in enumerate("JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split())}
MONTHS["SEPT"] = 9
DATE = r"(\d{1,2})\s?([A-Za-z]{3,4})(?:\s?(\d{2,4}))?"
TX_RE = re.compile(rf"^\s*{DATE}\s+(?:{DATE}\s+)?(.+?)\s{{1,}}(-?[\d,]+\.\d{{2}})\s*(CR|DR)?\s*$", re.I)
FX_RE = re.compile(r"^\s*([A-Z]{3})\s?([\d,]+\.\d{2})\s*$")


def _lines_pypdf(path, password):
    from pypdf import PdfReader
    rd = PdfReader(path)
    if rd.is_encrypted and not (password and rd.decrypt(password)):
        raise PermissionError
    out = []
    for page in rd.pages:
        try:
            t = page.extract_text(extraction_mode="layout")
        except TypeError:
            t = page.extract_text()
        out += (t or "").splitlines()
    return out


def _lines_plumber(path, password):
    import pdfplumber
    out = []
    with pdfplumber.open(path, password=password or None) as pdf:
        for page in pdf.pages:
            out += (page.extract_text() or "").splitlines()
    return out


def _lines_pdftotext(path, password):
    import shutil, subprocess
    exe = shutil.which("pdftotext")
    if not exe:
        raise ImportError
    cmd = [exe, "-layout"] + (["-upw", password] if password else []) + [path, "-"]
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.splitlines()


def pdf_lines(path, password):
    """Tries pdfplumber, pypdf, then the pdftotext program; the first one that finds transaction lines wins.
    (Different banks' PDFs embed text differently, so one library can come back empty where another works.)"""
    tried, locked = [], False
    for name, fn in (("pdfplumber", _lines_plumber), ("pypdf", _lines_pypdf), ("pdftotext", _lines_pdftotext)):
        try:
            lines = fn(path, password)
        except ImportError:
            continue
        except PermissionError:
            locked = True; continue
        except Exception as e:                     # wrong password, damaged file ...
            if "password" in str(e).lower() or "encrypt" in str(e).lower():
                locked = True
            tried.append(name); continue
        tried.append(name)
        if any(TX_RE.match(l) for l in lines):
            return lines
    if locked:
        sys.exit("this PDF is password protected. Run again with  --password YOURPASSWORD")
    if not tried:
        sys.exit("PDF support needs a PDF library. Install one with:  pip install pdfplumber   (or: pip install pypdf)")
    sys.exit("no transaction lines found. It may be a scanned image, or a layout this script doesn't know yet.")


def pdf_to_rows(lines):
    text = "\n".join(lines)
    sd = re.search(r"\b(\d{2})/(\d{2})/(\d{4})\b", text)
    st_year, st_month = (int(sd.group(3)), int(sd.group(2))) if sd else (None, 12)
    if st_year is None:
        import datetime
        st_year = datetime.date.today().year
    year_for = lambda mon: st_year - 1 if MONTHS[mon] > st_month else st_year
    card = re.search(r"\b\d{4}[- ]\d{4}[- ]\d{4}[- ](\d{4})\b", text)
    title = next((m for m in (re.search(r"([A-Z][A-Z .&'-]{2,40}?)\s+STATEMENT OF ACCOUNT", l) for l in lines) if m), None)
    bank = next((b for b, rx in (("Maybank", r"MAYBANK"), ("DBS", r"\bDBS\b"), ("UOB", r"\bUOB\b|UNITED OVERSEAS"), ("Citi", r"CITIBANK|\bCITI\b"), ("HSBC", r"HSBC"), ("OCBC", r"OCBC")) if re.search(rx, text, re.I)), "")
    rows = []
    if title or bank:
        rows.append(["Account Type:", (bank + " " + (title.group(1).strip() if title else "")).strip()])
    if card:
        rows.append(["Card Number:", "XXXX-XXXX-XXXX-" + card.group(1)])
    rows.append(["Transaction Date", "Posting Date", "Description", "Amount"])
    n_header = len(rows)

    def fmt(d, mon, y):
        mon = mon.upper()
        yy = (("20" + y) if len(y) == 2 else y) if y else str(year_for(mon))
        return f"{int(d):02d} {mon.title()[:3]} {yy}"

    last = None
    for raw in lines:
        m = TX_RE.match(raw)
        if m and m.group(2).upper() in MONTHS:
            post = fmt(m.group(4), m.group(5), m.group(6)) if m.group(5) and m.group(5).upper() in MONTHS else ""
            amt = m.group(8).replace(",", "")
            if (m.group(9) or "").upper() == "CR":
                amt = "-" + amt.lstrip("-")
            last = [fmt(m.group(1), m.group(2), m.group(3)), post, re.sub(r"\s{2,}", " ", m.group(7)).strip(), amt]
            rows.append(last)
            continue
        fx = FX_RE.match(raw)
        if fx and last and fx.group(1) != "SGD":
            last[2] += f" {fx.group(1)} {fx.group(2)}"
            last = None
        elif raw.strip():
            last = None
    if len(rows) == n_header:
        sys.exit("No transaction lines found. It may be a scanned image, or a layout this script doesn't know yet.")
    return rows


def do_pdf(path, outdir, password, keep_names):
    rows = pdf_to_rows(pdf_lines(path, password))
    rows = redact_rows(rows, keep_names)
    out = os.path.join(outdir, os.path.splitext(os.path.basename(path))[0] + "_redacted.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    return out, len(rows)


def main():
    ap = argparse.ArgumentParser(description="Redact card details from statement CSVs; convert PDF statements to CSV.")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--out", help="folder for the results (default: next to each original)")
    ap.add_argument("--password", help="password for protected PDFs")
    ap.add_argument("--keep-names", action="store_true", help="keep name/address lines in the header block (card numbers are still masked)")
    a = ap.parse_args()
    bad = 0
    for f in a.files:
        outdir = a.out or os.path.dirname(os.path.abspath(f))
        os.makedirs(outdir, exist_ok=True)
        ext = os.path.splitext(f)[1].lower()
        try:
            if ext == ".csv":
                out, n = do_csv(f, outdir, a.keep_names)
            elif ext == ".pdf":
                out, n = do_pdf(f, outdir, a.password, a.keep_names)
            else:
                print(f"skipped {f}: only .csv and .pdf are supported (save .xls as CSV first)"); bad += 1; continue
            print(f"ok  {os.path.basename(f)}  ->  {out}  ({n} rows)")
        except SystemExit as e:
            print(f"ERR {os.path.basename(f)}: {e}"); bad += 1
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
