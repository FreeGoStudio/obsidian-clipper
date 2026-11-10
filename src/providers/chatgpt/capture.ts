import { contentRoots } from './message-locator';
import { SelectionSnapshot } from './selection-snapshot';
import { convertMarkdown, codeLanguage } from './markdown-converter';
import { ChatGPTClipResult, ClipWarningCode } from './types';

const ATOMIC = 'table, .katex-display, .katex, math, [data-math]';

function covers(range: Range, node: Node): boolean {
	const whole = node.ownerDocument!.createRange();
	whole.selectNodeContents(node);
	return range.compareBoundaryPoints(Range.START_TO_START, whole) <= 0
		&& range.compareBoundaryPoints(Range.END_TO_END, whole) >= 0;
}

// Walk only the selected answer. Keeping the ancestor chain preserves inline,
// list, quote and code-language semantics that Range.cloneContents omits.
function cloneSelected(node: Node, range: Range): Node | null {
	if (!range.intersectsNode(node)) return null;
	if (node.nodeType === Node.TEXT_NODE) {
		const start = node === range.startContainer ? range.startOffset : 0;
		const end = node === range.endContainer ? range.endOffset : node.textContent!.length;
		return node.ownerDocument!.createTextNode(node.textContent!.slice(start, end));
	}
	if (!(node instanceof Element)) return null;
	const clone = node.cloneNode(false) as Element;
	if (node.matches('pre, [data-code-block], .cm-editor, .cm-content')) {
		clone.setAttribute('data-language', codeLanguage(node));
	}
	for (const child of Array.from(node.childNodes)) {
		const selected = cloneSelected(child, range);
		if (selected) clone.append(selected);
	}
	if (node.tagName === 'LI' && !clone.querySelector('input[type="checkbox"]')) {
		const checkbox = node.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
		if (checkbox) clone.prepend(checkbox.cloneNode(true));
	}
	if (node.tagName === 'OL') {
		const children = Array.from(node.children).filter(el => el.tagName === 'LI');
		let index = Number(node.getAttribute('start') || 1);
		for (const child of children) {
			if (child.hasAttribute('value')) index = Number(child.getAttribute('value'));
			if (range.intersectsNode(child)) break;
			index++;
		}
		clone.setAttribute('start', String(index));
	}
	return clone;
}

export function captureSnapshot(snapshot: SelectionSnapshot): ChatGPTClipResult {
	const { answer, url, text } = snapshot;
	const doc = answer.ownerDocument;
	const range = snapshot.range.cloneRange();
	const expansion = new Set<ClipWarningCode>();
	const roots = contentRoots(answer);
	const atoms = Array.from(answer.querySelectorAll(ATOMIC)).filter(node =>
		!node.parentElement?.closest(ATOMIC) && range.intersectsNode(node));
	for (const atom of atoms) {
		if (covers(range, atom)) continue;
		const atomRange = doc.createRange();
		atomRange.selectNode(atom);
		if (range.compareBoundaryPoints(Range.START_TO_START, atomRange) > 0) range.setStartBefore(atom);
		if (range.compareBoundaryPoints(Range.END_TO_END, atomRange) < 0) range.setEndAfter(atom);
		expansion.add(atom.tagName === 'TABLE' ? 'selection-expanded-to-table' : 'selection-expanded-to-math');
	}
	const selected = doc.createElement('div');
	const complete = doc.createElement('div');
	for (const root of roots) {
		complete.append(root.cloneNode(true));
		const part = cloneSelected(root, range);
		if (part) selected.append(part);
	}
	const selection = convertMarkdown(selected, url);
	const whole = convertMarkdown(complete, url);
	if (answer.matches('[aria-busy="true"], [data-is-streaming="true"]')) {
		whole.warnings.push('incomplete-dom'); selection.warnings.push('incomplete-dom');
	}
	if (Array.from(answer.querySelectorAll('canvas, svg, iframe, video, audio, [data-rich-content]')).some(node =>
		!node.closest('button, [data-markdown-copy="exclude"], [hidden], [aria-hidden="true"]') && !roots.some(root => root.contains(node)))) {
		whole.warnings.push('unsupported-rich-content');
	}
	if (!selection.markdown.trim()) throw new Error('选区没有可保存的正文，请重新选择助手回答中的内容。');
	const selectionWarnings = Array.from(new Set([...expansion, ...selection.warnings]));
	return { provider: 'chatgpt', scope: 'selection', markdown: selection.markdown,
		selectionMarkdown: selection.markdown, answerMarkdown: whole.markdown, sourceUrl: url,
		conversationTitle: doc.title, selectedText: text, warnings: selectionWarnings,
		selectionWarnings, answerWarnings: whole.warnings };
}
