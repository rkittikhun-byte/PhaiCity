/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Shows the project's credits files (assets/CREDITS.md and friends) on the About page, so the page lists
// every credit without copying them. Only the Markdown those files use is understood: headings, paragraphs,
// bullet lists, pipe tables, and inline links, `code` and **bold**. The page is built from DOM nodes,
// never innerHTML, and only http(s) links become links.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: number; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: Inline[][] }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] };

const INLINE_TOKEN = /(\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*)/;

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  for (const part of text.split(INLINE_TOKEN)) {
    if (part === "") continue;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) parts.push({ kind: "link", text: link[1].replace(/`/g, ""), href: link[2] });
    else if (/^`[^`]+`$/.test(part)) parts.push({ kind: "code", text: part.slice(1, -1) });
    else if (/^\*\*[^*]+\*\*$/.test(part)) parts.push({ kind: "bold", text: part.slice(2, -2) });
    else parts.push({ kind: "text", text: part });
  }
  return parts;
}

// "| a | b |" → ["a", "b"]; "\|" stays a literal bar inside a cell
function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  let table: string[][] | null = null;

  const flush = (): void => {
    if (paragraph.length) blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    if (list) blocks.push({ kind: "list", items: list.map(parseInline) });
    if (table) {
      const [header = [], ...rest] = table;
      const rows = rest.filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
      blocks.push({ kind: "table", header: header.map(parseInline), rows: rows.map((cells) => cells.map(parseInline)) });
    }
    paragraph = [];
    list = null;
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (line.trim() === "") flush();
    else if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, content: parseInline(heading[2]) });
    } else if (line.trimStart().startsWith("|")) {
      if (!table) flush();
      (table ??= []).push(tableCells(line));
    } else if (item) {
      if (!list) flush();
      (list ??= []).push(item[1]);
    } else if (list && /^\s+\S/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`; // a list item carried onto the next line
    } else {
      if (list || table) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** Only web links are followed; anything else (relative paths, javascript:, data:) shows as plain text. */
export function isWebLink(href: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(href);
}

function renderInline(parts: Inline[], doc: Document): Node[] {
  return parts.map((part) => {
    if (part.kind === "text") return doc.createTextNode(part.text);
    if (part.kind === "link" && isWebLink(part.href)) {
      const a = doc.createElement("a");
      a.href = part.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = part.text;
      return a;
    }
    const element = doc.createElement(part.kind === "bold" ? "strong" : part.kind === "code" ? "code" : "span");
    element.textContent = part.text;
    return element;
  });
}

/** The credits as page content; the file's own top heading is left out, since the page has one. */
export function renderMarkdown(blocks: Block[], doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const block of blocks) {
    if (block.kind === "heading") {
      if (block.level === 1) continue;
      const heading = doc.createElement(block.level === 2 ? "h4" : "h5");
      heading.append(...renderInline(block.content, doc));
      fragment.append(heading);
    } else if (block.kind === "paragraph") {
      const p = doc.createElement("p");
      p.append(...renderInline(block.content, doc));
      fragment.append(p);
    } else if (block.kind === "list") {
      const ul = doc.createElement("ul");
      for (const item of block.items) {
        const li = doc.createElement("li");
        li.append(...renderInline(item, doc));
        ul.append(li);
      }
      fragment.append(ul);
    } else {
      const wrap = doc.createElement("div");
      wrap.className = "creditsTableWrap";
      const table = doc.createElement("table");
      const headRow = doc.createElement("tr");
      for (const cell of block.header) {
        const th = doc.createElement("th");
        th.append(...renderInline(cell, doc));
        headRow.append(th);
      }
      table.createTHead().append(headRow);
      const body = table.createTBody();
      for (const row of block.rows) {
        const tr = doc.createElement("tr");
        for (const cell of row) {
          const td = doc.createElement("td");
          td.append(...renderInline(cell, doc));
          tr.append(td);
        }
        body.append(tr);
      }
      wrap.append(table);
      fragment.append(wrap);
    }
  }
  return fragment;
}
