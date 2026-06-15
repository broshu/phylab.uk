#!/usr/bin/env python3
"""Add a resource card to phylab.uk/resources/index.html.

Usage:
    python3 add_to_index.py <index.html> <pdf_filename> "<Title>" <thumb_path>

Example:
    python3 add_to_index.py phylab.uk/resources/index.html \
        capacitance.pdf "Capacitance" thumbs/capacitance.jpg

Inserts a new <a class="block"> card at the top of the <div class="blocks">
grid (newest first), matching the existing markup. Idempotent: if a card already
points at the same PDF, nothing changes.
"""
import html as html_mod
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    index_path = Path(sys.argv[1])
    pdf, title, thumb = sys.argv[2], sys.argv[3], sys.argv[4]
    doc = index_path.read_text(encoding="utf-8")

    if f'href="{pdf}"' in doc:
        print(f"Card for {pdf} already present — leaving index unchanged.")
        return

    esc_title = html_mod.escape(title)
    card = (
        f'      <a class="block" href="{pdf}" target="_blank" rel="noopener">\n'
        f'        <h2>{esc_title}</h2>\n'
        f'        <img src="{thumb}" alt="{esc_title} — first page preview" loading="lazy">\n'
        f'      </a>\n'
    )

    marker = '<div class="blocks">'
    idx = doc.find(marker)
    if idx == -1:
        sys.exit('Could not find <div class="blocks"> in the index.')
    insert_at = doc.find("\n", idx) + 1
    new_doc = doc[:insert_at] + card + doc[insert_at:]
    index_path.write_text(new_doc, encoding="utf-8")
    print(f"Added card '{title}' -> {pdf} at top of grid in {index_path}")


if __name__ == "__main__":
    main()
