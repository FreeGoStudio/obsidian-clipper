// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { SelectionCache } from '../selection-snapshot';
import { captureSnapshot } from '../capture';
import { isChatGPTUrl } from '../detect';
import { withScope } from '../types';
import { convertMarkdown } from '../markdown-converter';

beforeEach(() => { document.body.innerHTML = ''; window.getSelection()!.removeAllRanges(); });
function setup(html: string, attr = 'data-message-author-role="assistant"') {
	document.body.innerHTML = `<article ${attr}>${html}</article>`;
}
function select(start: Node, from = 0, end = start, to = end.textContent!.length) {
	const range = document.createRange(); range.setStart(start, from); range.setEnd(end, to);
	const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
	const cache = new SelectionCache(document); cache.remember(); return cache;
}
function capture(css: string, from = 0, to?: number) {
	const node = document.querySelector(css)!.firstChild!;
	return captureSnapshot(select(node, from, node, to ?? node.textContent!.length).get());
}

test('SEL-01/02: actual selected characters, formatting ancestors and answer switch', () => {
	setup('<p>before <strong>selected</strong> after</p><p>second</p>');
	const clip = capture('strong', 1, 4);
	expect(clip.markdown).toBe('**ele**');
	expect(withScope(clip, 'answer').markdown).toBe('before **selected** after\n\nsecond');
	expect(withScope(clip, 'answer').selectionMarkdown).toBe('**ele**');
});
test('SEL-03: partial paragraphs remain distinct', () => {
	setup('<p>alpha</p><p>bravo</p>');
	const ps = document.querySelectorAll('p');
	expect(captureSnapshot(select(ps[0].firstChild!, 2, ps[1].firstChild!, 3).get()).markdown).toBe('pha\n\nbra');
});
test.each(['data-message-author-role="assistant"', 'data-turn="assistant"', 'data-chatgpt-search-unit-key="1:assistant"',
	'data-content-search-unit-key="1:assistant"', 'data-markdown-text-style="assistant-message"'])('DOM compatibility %s', attr => {
	setup('<p>answer</p>', attr); expect(capture('p', 0, 1).answerMarkdown).toBe('answer');
});
test('SEL-04/05: user and cross-message selections replace previous valid cache with errors', () => {
	document.body.innerHTML = '<div data-turn="assistant"><p>one</p></div><div data-turn="user"><p>user</p></div><div data-turn="assistant"><p>two</p></div>';
	const ps = document.querySelectorAll('p');
	expect(() => select(ps[0].firstChild!, 0, ps[2].firstChild!, 2).get()).toThrow('同一条助手');
	expect(() => select(ps[1].firstChild!).get()).toThrow('同一条助手');
	expect(() => new SelectionCache(document).get()).toThrow('请先');
});
test('SEL-06/07: toolbar collapse keeps snapshot; replacement, text mutation or URL change invalidates', () => {
	setup('<p>original</p>'); const cache = select(document.querySelector('p')!.firstChild!);
	window.getSelection()!.removeAllRanges(); cache.remember(); expect(captureSnapshot(cache.get()).markdown).toBe('original');
	document.querySelector('p')!.textContent = 'replacement'; expect(() => cache.get()).toThrow('重新选择');
});
test('same-node edits cannot silently update the snapshot', () => {
	setup('<p>original</p>'); const node = document.querySelector('p')!.firstChild!; const cache = select(node);
	node.textContent = 'changed'; expect(() => cache.get()).toThrow('重新选择');
});
test('partial code keeps only selected code including whitespace and language', () => {
	setup('<pre><code class="language-ts">first\n  selected  \n\nlast</code></pre>');
	expect(capture('code', 6, 19).markdown).toBe('```ts\n  selected  \n```');
});
test('partial CodeMirror lines preserve boundaries', () => {
	setup('<pre data-language="python"><div class="cm-content"><div class="cm-line">first</div><div class="cm-line">  second</div><div class="cm-line">last</div></div></pre>');
	const lines = document.querySelectorAll('.cm-line');
	expect(captureSnapshot(select(lines[0].firstChild!, 2, lines[1].firstChild!, 5).get()).markdown).toBe('```python\nrst\n  sec\n```');
});
test('MD-07/09: partial atoms expand with warnings; full atoms do not warn', () => {
	setup('<p>before <span class="katex"><annotation encoding="application/x-tex">x^2</annotation><span id="render">xx</span></span> after</p><table><tr><th>A</th></tr><tr><td>B</td></tr></table>');
	const math = capture('#render', 0, 1);
	expect(math.markdown).toBe('$x^2$'); expect(math.warnings).toContain('selection-expanded-to-math');
	const table = capture('td'); expect(table.markdown).toBe('| A |\n| --- |\n| B |');
	expect(table.warnings).toContain('selection-expanded-to-table');
	expect(withScope(table, 'answer').warnings).not.toContain('selection-expanded-to-table');
});
test('selected nested list and quote preserve enclosing semantics and numbering', () => {
	setup('<blockquote><ol start="10"><li>first</li><li><strong>second</strong></li></ol></blockquote>');
	expect(capture('strong').markdown).toBe('> 11. **second**');
});
test('MD-12/SEC: warnings, missing formulas, dangerous content and URLs', () => {
	const root = document.createElement('div'); root.innerHTML = '<script>alert(1)</script><p onclick="bad()"><a href="javascript:bad()">safe</a><img src="data:text/html,bad" alt="image"></p><canvas></canvas><span class="katex"><span class="katex-html">x</span></span><button class="citation-marker">1</button>';
	const result = convertMarkdown(root, 'https://chatgpt.com');
	expect(result.markdown).not.toMatch(/javascript:|data:|onclick|alert/);
	expect(result.warnings).toEqual(expect.arrayContaining(['unsupported-rich-content', 'external-image-url', 'missing-formula-source', 'citation-target-unavailable']));
});
test('exact hosts only', () => {
	expect(isChatGPTUrl('https://chatgpt.com/c/1')).toBe(true);
	expect(isChatGPTUrl('https://chat.openai.com/')).toBe(true);
	for (const url of ['https://chatgpt.com.evil.test', 'https://evil.test/chatgpt.com', 'http://chatgpt.com', 'invalid']) expect(isChatGPTUrl(url)).toBe(false);
});

test('partial code retains language from the original toolbar', () => {
	setup('<pre><div class="sticky">Python<button>Copy</button></div><code>first\nsecond</code></pre>');
	expect(capture('code', 6).markdown).toBe('```python\nsecond\n```');
});
test('partial task item retains its checkbox semantics', () => {
	setup('<ul><li><input type="checkbox" checked><strong>done</strong></li></ul>');
	expect(capture('strong').markdown).toBe('- [x] **done**');
});
test('full table selection needs no expansion warning', () => {
	setup('<table><tr><th>A</th></tr><tr><td>B</td></tr></table>');
	const range = document.createRange(); range.selectNodeContents(document.querySelector('article')!);
	window.getSelection()!.addRange(range); const cache = new SelectionCache(document); cache.remember();
	expect(captureSnapshot(cache.get()).warnings).not.toContain('selection-expanded-to-table');
});
test('streaming answer and rich content outside markdown roots warn', () => {
	setup('<div class="markdown"><p>text</p></div><canvas>chart</canvas>', 'data-turn="assistant" aria-busy="true"');
	const clip = capture('p'); expect(clip.answerWarnings).toContain('unsupported-rich-content');
	expect(clip.warnings).toContain('incomplete-dom');
});
test('unknown custom components retain text and warn', () => {
	setup('<x-chart>chart text</x-chart>');
	expect(capture('x-chart').markdown).toBe('chart text');
	expect(capture('x-chart').warnings).toContain('unsupported-rich-content');
});
test('SPA navigation invalidates cached selections', () => {
	setup('<p>selected</p>'); const cache = select(document.querySelector('p')!.firstChild!);
	const previous = location.href; history.replaceState({}, '', '/c/another');
	try { expect(() => cache.get()).toThrow('重新选择'); }
	finally { history.replaceState({}, '', previous); }
});
