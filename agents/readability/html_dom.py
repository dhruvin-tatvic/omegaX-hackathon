"""Minimal HTML DOM for structured-fact extraction (stdlib only)."""

from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

WHITESPACE_RE = re.compile(r"\s+")


class Node:
    def __init__(self, tag: str, attrs: dict[str, str] | None = None, parent: Node | None = None) -> None:
        self.tag = tag
        self.attrs = attrs or {}
        self.parent = parent
        self.children: list[Node] = []

    @property
    def classes(self) -> list[str]:
        return [token for token in str(self.attrs.get("class") or "").split() if token]

    def has_class(self, token: str) -> bool:
        return token in self.classes

    def get(self, name: str) -> str | None:
        wanted = name.lower()
        for key, value in self.attrs.items():
            if key.lower() == wanted:
                return value
        return None

    def add(self, child: Node) -> None:
        child.parent = self
        self.children.append(child)

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def find_all(self, tag: str | None = None, class_name: str | None = None) -> list[Node]:
        found: list[Node] = []
        for node in self.walk():
            if node.tag.startswith("#"):
                continue
            if tag and node.tag != tag:
                continue
            if class_name and not node.has_class(class_name):
                continue
            found.append(node)
        return self_or_descendants_unique(found)

    def closest_class(self, token: str) -> Node | None:
        node: Node | None = self
        while node is not None:
            if node.has_class(token):
                return node
            node = node.parent
        return None

    def text(self) -> str:
        if self.tag == "#text":
            return unescape(self.attrs.get("data") or "")
        parts = [child.text() for child in self.children]
        return "".join(parts)

    def collapsed_text(self) -> str:
        return WHITESPACE_RE.sub(" ", self.text()).strip()


def self_or_descendants_unique(nodes: list[Node]) -> list[Node]:
    seen: set[int] = set()
    out: list[Node] = []
    for node in nodes:
        ident = id(node)
        if ident in seen:
            continue
        seen.add(ident)
        out.append(node)
    return out


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("#document")
        self._stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {key: value or "" for key, value in attrs}, self._stack[-1])
        self._stack[-1].add(node)
        if tag not in VOID_TAGS:
            self._stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self._stack) - 1, 0, -1):
            if self._stack[index].tag == tag:
                del self._stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if not data:
            return
        self._stack[-1].add(Node("#text", {"data": data}, self._stack[-1]))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {key: value or "" for key, value in attrs}, self._stack[-1])
        self._stack[-1].add(node)


def parse_html(html: str) -> Node:
    parser = _Parser()
    parser.feed(html or "")
    parser.close()
    return parser.root


def table_matrix(table: Node) -> tuple[list[str], list[list[str]]]:
    headers: list[str] = []
    rows: list[list[str]] = []
    thead = next((child for child in table.children if child.tag == "thead"), None)
    tbody = next((child for child in table.children if child.tag == "tbody"), None)
    header_row = None
    if thead:
        header_row = next((child for child in thead.children if child.tag == "tr"), None)
    if header_row is None:
        first_tr = next((child for child in (tbody or table).children if child.tag == "tr"), None)
        if first_tr and any(cell.tag == "th" for cell in first_tr.children):
            header_row = first_tr
    if header_row:
        headers = [cell.collapsed_text() for cell in header_row.children if cell.tag in {"th", "td"}]
    body_parent = tbody or table
    for row in body_parent.children:
        if row.tag != "tr" or row is header_row:
            continue
        cells = [cell.collapsed_text() for cell in row.children if cell.tag in {"td", "th"}]
        if cells:
            rows.append(cells)
    return headers, rows


def script_jsonld_texts(root: Node) -> list[str]:
    texts: list[str] = []
    for node in root.find_all("script"):
        if (node.get("type") or "").lower() == "application/ld+json":
            raw = node.collapsed_text()
            if raw:
                texts.append(raw)
    return texts
