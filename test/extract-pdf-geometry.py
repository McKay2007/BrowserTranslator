"""Prepare a local PDF and independent first-page coordinates for alignment checks."""
import argparse
import json
import shutil
from pathlib import Path

import pdfplumber

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("pdf", type=Path)
args = parser.parse_args()
output = Path(__file__).resolve().parent.parent / "tmp" / "pdfs"
output.mkdir(parents=True, exist_ok=True)
with pdfplumber.open(args.pdf) as pdf:
    page = pdf.pages[0]
    geometry = {"width": page.width, "height": page.height, "words": page.extract_words()}
sample = output / "alignment-sample.pdf"
if args.pdf.resolve() != sample.resolve():
    shutil.copyfile(args.pdf, sample)
(output / "page1-geometry.json").write_text(json.dumps(geometry, ensure_ascii=False), encoding="utf-8")
print("Prepared first-page geometry. Open /test/pdf-browser.html?alignment=1 on the local test server.")
