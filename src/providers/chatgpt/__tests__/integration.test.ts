// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import * as defuddle from 'defuddle/full';
import { initializePageContent, extractPageContent } from '../../../utils/content-extractor';
import { compileTemplate } from '../../../utils/template-compiler';
import { generateFrontmatter, saveToObsidian } from '../../../utils/obsidian-note-creator';
import { generalSettings } from '../../../utils/storage-utils';
import browser from '../../../utils/browser-polyfill';
import { ChatGPTClipResult, withScope } from '../types';
import { renderChatGPTControls } from '../popup-controls';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('defuddle/full', async importOriginal => {
	const actual = await importOriginal<typeof import('defuddle/full')>();
	return { ...actual, createMarkdownContent: vi.fn(actual.createMarkdownContent) };
});

const clip: ChatGPTClipResult = {
	provider: 'chatgpt', scope: 'selection', markdown: '**selected**', selectionMarkdown: '**selected**',
	answerMarkdown: '## Answer\n\n```ts\na  \n\nb\n```\n\n$x^2$', sourceUrl: 'https://chatgpt.com/c/example',
	conversationTitle: 'Test', selectedText: 'selected', warnings: [], selectionWarnings: [], answerWarnings: ['external-image-url'],
};
function initialize(result?: ChatGPTClipResult) {
	return initializePageContent('<p>ordinary <strong>web</strong></p>', '', {}, result?.sourceUrl || 'https://example.com',
		{}, '', [], 'Test', '', '', '', '', '', '', 0, '', [], result);
}
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); generalSettings.legacyMode = false; });

test('INT-01/02/03: dedicated Markdown bypasses HTML converter and survives template compilation', async () => {
	const convert = vi.mocked(defuddle.createMarkdownContent);
	for (const scope of ['selection', 'answer'] as const) {
		const current = withScope(clip, scope);
		const result = await initialize(current);
		expect(result.currentVariables['{{content}}']).toBe(current.markdown);
		expect(result.currentVariables['{{selection}}']).toBe(clip.selectionMarkdown);
		expect(await compileTemplate(1, '{{content}}', result.currentVariables, current.sourceUrl)).toBe(current.markdown);
	}
	expect(convert).not.toHaveBeenCalled();
});
test('INT-04: ordinary web still uses upstream converter and template variables', async () => {
	const convert = vi.mocked(defuddle.createMarkdownContent);
	const result = await initialize();
	expect(convert).toHaveBeenCalledWith('<p>ordinary <strong>web</strong></p>', 'https://example.com');
	expect(result.currentVariables['{{content}}']).toBe('ordinary **web**');
});
test('OBS-01/02: original URI saver preserves body, vault, directory, tags and create does not overwrite', async () => {
	generalSettings.legacyMode = true;
	const send = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({});
	const fm = await generateFrontmatter([{ name: 'tags', value: 'chatgpt' }, { name: 'source', value: clip.sourceUrl }]);
	await saveToObsidian(fm + clip.answerMarkdown, 'Test:note', 'Clips', 'My Vault', 'create');
	const message = send.mock.calls[0][0] as { url: string };
	const url = new URL(message.url);
	expect(url.searchParams.get('vault')).toBe('My Vault');
	expect(url.searchParams.get('file')).toMatch(/^Clips\/Test/);
	expect(url.searchParams.has('overwrite')).toBe(false);
	expect(url.searchParams.get('content')).toBe(fm + clip.answerMarkdown);
	expect(fm).toContain('chatgpt');
});
test('selection errors are not retried as generic extraction or replaced by whole-page content', async () => {
	const send = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ chatgptError: '请选择同一条助手回答' });
	expect((await extractPageContent(1))?.chatgptError).toContain('同一条助手');
	expect(send).toHaveBeenCalledTimes(1);
});
test('scope controls are accessible, default to selection and show warnings as text', async () => {
	document.body.innerHTML = '<main class="clipper"><textarea id="note-content-field"></textarea></main>';
	const change = vi.fn(async () => {});
	renderChatGPTControls(clip, change);
	const select = document.querySelector<HTMLSelectElement>('#chatgpt-scope')!;
	expect(select.value).toBe('selection');
	select.value = 'answer'; select.dispatchEvent(new Event('change'));
	await Promise.resolve(); expect(change).toHaveBeenCalledWith('answer');
	renderChatGPTControls(withScope(clip, 'answer'), change);
	expect(document.querySelector('[role="status"]')?.textContent).toContain('不保证离线');
	renderChatGPTControls(undefined, change); expect(document.getElementById('chatgpt-controls')).toBeNull();
});

test('optional ChatGPT template uses supported variables and preserves final note content', async () => {
	const template = JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/chatgpt-clipper/chatgpt-template.json'), 'utf8'));
	const variables = (await initialize(withScope(clip, 'answer'))).currentVariables;
	const content = await compileTemplate(1, template.noteContentFormat, variables, clip.sourceUrl);
	expect(content).toBe(`> [!source] 对话来源\n> [打开原 ChatGPT 对话](${clip.sourceUrl})\n\n${clip.answerMarkdown}`);
	const created = template.properties.find((p: { name: string }) => p.name === 'created');
	expect(await compileTemplate(1, created.value, variables, clip.sourceUrl)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
	expect(template.behavior).toBe('create'); expect(template.triggers).toEqual([]);
});
