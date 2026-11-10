// Adapted from chatgpt-md-fab markdown.js, ae9f010 (MIT).
// Copyright (c) 2025. Full license: THIRD_PARTY_NOTICES.md.
import { USER } from './message-locator';
import { ClipWarningCode } from './types';
const OMIT = `script, style, template, svg, button, form, nav, header, footer, .sr-only, [hidden], [aria-hidden="true"], [data-markdown-copy="exclude"], [data-d-component="favicon"], [data-d-component="icon"], ${USER}`;
function normalize(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

// Merge only adjacent block boundaries. Never rewrite whitespace inside code or math.
function join(parts: string[]) {
  let result = "";
  for (const part of parts) {
    if (!part) continue;
    const left = result.endsWith("\n") ? result.match(/\n+$/)![0].length : 0;
    const right = part.startsWith("\n") ? part.match(/^\n+/)![0].length : 0;
    result = left && right
      ? result.slice(0, -left) + "\n".repeat(Math.min(2, Math.max(left, right))) + part.slice(right)
      : result + part;
  }
  return result;
}

function inlineCode(value: string) {
  const text = normalize(value).replace(/\n/g, " ");
  if (!text) return "";
  const ticks = Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length));
  const fence = "`".repeat(ticks + 1);
  const pad = /^`|`$/.test(text) || (/^ .* $/.test(text) && /[^ ]/.test(text)) ? " " : "";
  return fence + pad + text + pad + fence;
}

function codeText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue || "";
  if (!(node instanceof Element) || node.matches('button, svg, .cm-gutters, .cm-tooltip')) return "";
  if (node.tagName === "BR") return "\n";
  const lines = Array.from(node.children).filter(child => child.matches('.cm-line'));
  if (lines.length) return lines.map(line => line.childNodes.length === 1 && line.firstChild?.nodeName === "BR" ? "" : codeText(line)).join("\n");
  return Array.from(node.childNodes, codeText).join("");
}

export function codeLanguage(pre: Element, source = pre.querySelector('.cm-content, code') || pre): string {
  const classes = `${pre.className} ${source.className} ${pre.querySelector('code')?.className || ""}`;
  let language = classes.match(/(?:language|lang)-([\w#+.-]+)/i)?.[1]
    || source.getAttribute('data-language') || pre.getAttribute('data-language') || "";
  if (!language) {
    const labels = pre.querySelectorAll('[data-language], .sticky, .select-none');
    for (const label of Array.from(labels)) {
      if (source.contains(label) || label.contains(source)) continue;
      const value = (label.getAttribute('data-language') || codeText(label)).trim();
      if (/^[a-z][\w#+.-]{0,24}$/i.test(value) && !/^(copy|copied|run|edit)$/i.test(value)) {
        language = value;
        break;
      }
    }
  }
  return language;
}

function codeBlock(pre: Element) {
  const source = pre.matches('.cm-content') ? pre : pre.querySelector('.cm-content') || pre.querySelector('code') || pre;
  let text = normalize(codeText(source)).replace(/\u00a0/g, " ");
  if (text.endsWith("\n")) text = text.slice(0, -1);
  const language = codeLanguage(pre, source);
  const fence = "`".repeat(Math.max(3, ...(text.match(/`+/g) || []).map(run => run.length + 1)));
  return `\n\n${fence}${language.replace(/[^\w#+.-]/g, "").toLowerCase()}\n${text}\n${fence}\n\n`;
}

function escapeText(value: string) {
  return value.replace(/\s+/g, " ").replace(/([\\`*_[\]<>~])/g, "\\$1");
}

function destination(value: string | null, baseURI: string) {
  if (!value) return "";
  try {
    const url = new URL(value, baseURI);
    if (!/^(https?:|mailto:)/.test(url.protocol)) return "";
    return url.href.replace(/[()\\<>\s]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch {
    return "";
  }
}

function renderMarkdown(root: Element, baseURI: string, warnings: Set<ClipWarningCode>) {

  const children = (node: Node): string => join(Array.from(node.childNodes, walk));
  const block = (text: string) => text ? `\n\n${text}\n\n` : "";
  const clean = (text: string) => text.trim().replace(/^(#{1,6}|>|[-+])(?=\s)/, "\\$1").replace(/^(\d+)[.)](?=\s)/, "$1\\.");

  function listMarkdown(list: Element) {
    const ordered = list.tagName === "OL";
    let index = Number.parseInt(list.getAttribute('start') || "1", 10);
    if (!Number.isFinite(index)) index = 1;
    const rows = Array.from(list.children).filter(child => child.tagName === "LI").map(li => {
      if (li.hasAttribute('value')) index = Number.parseInt(li.getAttribute('value') || '1', 10) || index;
      const marker = ordered ? `${index++}. ` : "- ";
      const checkbox = li.querySelector<HTMLInputElement>(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
      const task = checkbox ? (checkbox.checked ? "[x] " : "[ ] ") : "";
      const text = children(li).trim();
      return marker + task + text.replace(/\n/g, "\n" + " ".repeat(marker.length));
    });
    return block(rows.join("\n"));
  }

  function tableMarkdown(table: HTMLTableElement) {
    const rows = Array.from(table.rows, row => Array.from(row.cells, cell => children(cell).trim()
      .replace(/\|/g, "\\|").replace(/\n+/g, "<br>"))).filter(row => row.length);
    if (!rows.length) return "";
    const width = Math.max(...rows.map(row => row.length));
    const normalized = rows.map(row => Array.from({ length: width }, (_, i) => row[i] || ""));
    const separator = Array.from({ length: width }, (_, i) => {
      const cell = table.rows[0]?.cells[i];
      const align = cell?.getAttribute('align') || cell?.style.textAlign;
      return align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---";
    });
    return block([normalized[0], separator, ...normalized.slice(1)].map(row => `| ${row.join(" | ")} |`).join("\n"));
  }

  function walk(node: Node): string {
    if (node.nodeType === 3) {
      if (/^\s*\n\s*$/.test(node.nodeValue || "")
        && [node.previousSibling, node.nextSibling].some(sibling => sibling instanceof Element
          && /^(H[1-6]|P|DIV|SECTION|PRE|UL|OL|TABLE|BLOCKQUOTE|HR)$/.test(sibling.tagName))) return "";
      return escapeText(node.nodeValue || "");
    }
    if (!(node instanceof Element)) return "";
    const tag = node.tagName;
    // Formula source must be read before skipping its aria-hidden rendered layers.
    if (node.matches('.katex-display, .katex, math, [data-math]')) {
      const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent
        || node.getAttribute('data-math');
      if (tex) return node.matches('.katex-display, [display="block"]') ? block(`$$\n${tex.trim()}\n$$`) : `$${tex.trim()}$`;
    }
    if (node.matches('.katex-display, .katex, math, [data-math]')) {
      warnings.add('missing-formula-source');
      return escapeText(node.querySelector('.katex-html')?.textContent || node.textContent || '');
    }
    if (node.matches('canvas, svg, iframe, object, video, audio, [role="application"], [role="button"], [data-rich-content]')) {
      if (!node.closest('[data-markdown-copy="exclude"], button, [data-d-component="icon"]')) {
        warnings.add('unsupported-rich-content');
        return block(escapeText(node.textContent || '[无法转换的富内容，请查看原对话]'));
      }
    }
    if (node.matches('.citation-marker, [data-citation]') && !node.matches('a[href]') && !node.querySelector('a[href]')) warnings.add('citation-target-unavailable');
    if (tag === "TABLE" && node.querySelector('[rowspan], [colspan]')) warnings.add('unsupported-rich-content');
    if (tag === "BUTTON" && node.matches('.entity-underline, .citation-marker')
      && !node.matches('[hidden], [aria-hidden="true"], [data-markdown-copy="exclude"]')) return children(node).trim();
    if (node.matches(OMIT)) return "";
    if (tag === "PRE" || node.matches('[data-code-block], [data-markdown-copy="code-block"], .cm-editor, .cm-content')) return codeBlock(node);
    if (tag === "CODE") return inlineCode(node.textContent || "");
    if (tag === "BR") return "  \n";
    if (tag === "INPUT") return "";
    if (tag === "HR") return block("---");
    if (/^H[1-6]$/.test(tag)) return block(`${"#".repeat(Number(tag[1]))} ${children(node).trim()}`);
    if (tag === "P") return block(clean(children(node)));
    if (tag === "UL" || tag === "OL") return listMarkdown(node);
    if (tag === "BLOCKQUOTE") return block(children(node).trim().split("\n").map(line => `> ${line}`).join("\n"));
    if (tag === "TABLE") return tableMarkdown(node as HTMLTableElement);
    if (tag === "A") {
      const text = children(node).trim();
      const href = destination(node.getAttribute('href'), baseURI);
      return href ? `[${text || escapeText(href)}](${href})` : text;
    }
    if (tag === "IMG") {
      warnings.add('external-image-url');
      const src = destination(node.getAttribute('src'), baseURI);
      return src ? `![${escapeText(node.getAttribute('alt') || "")}](${src})` : escapeText(node.getAttribute("alt") || "[图片链接不可用]");
    }
    if (tag.includes('-')) warnings.add('unsupported-rich-content');
    const text = children(node);
    const bold = /^(STRONG|B)$/.test(tag) || node.hasAttribute('data-d-default-strong');
    const italic = /^(EM|I)$/.test(tag) || node.getAttribute('data-d-font-style') === "italic";
    if (bold || italic || /^(DEL|S)$/.test(tag)) {
      const marker = /^(DEL|S)$/.test(tag) ? "~~" : (bold ? "**" : "") + (italic ? "*" : "");
      return text.trim() ? text.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, before, body, after) => `${before}${marker}${body}${marker}${after}`) : text;
    }
    if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "FIGURE" || tag === "FIGCAPTION") return block(text.trim());
    return text;
  }

  return children(root).trim();
}

export function convertMarkdown(root: Element, baseURI: string): { markdown: string; warnings: ClipWarningCode[] } {
  const warnings = new Set<ClipWarningCode>();
  if (root.querySelector('[aria-busy="true"], [data-is-streaming="true"], details:not([open])')) warnings.add('incomplete-dom');
  return { markdown: renderMarkdown(root, baseURI, warnings), warnings: Array.from(warnings) };
}
