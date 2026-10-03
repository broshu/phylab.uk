"""Parse APS RSS 1.0 metadata using Python's standard XML library."""
import json
import re
import sys
import xml.etree.ElementTree as ET

ns = {
    "rss": "http://purl.org/rss/1.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "prism": "http://prismstandard.org/namespaces/basic/2.0/",
}
root = ET.fromstring(sys.stdin.read())
items = root.findall("rss:item", ns)
if not items:
    raise ValueError("APS feed contained no RSS items; check source format")
metadata = []
for item in items:
    def field(name):
        return item.findtext(name, default="", namespaces=ns)

    date = field("prism:publicationDate")[:10]
    authors = re.split(r",\s*(?:and\s+)?|\s+and\s+", field("dc:creator"))
    metadata.append({
        "DOI": field("prism:doi"),
        "title": [field("rss:title")],
        "author": [{"name": author.strip()} for author in authors if author.strip()],
        "container-title": [field("prism:publicationName")],
        "published": {"date-parts": [[int(n) for n in date.split("-")]]} if date else {},
    })
json.dump(metadata, sys.stdout, ensure_ascii=False)
