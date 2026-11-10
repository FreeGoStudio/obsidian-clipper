// Real MV3 extension smoke test using synthetic HTML; no ChatGPT account or Vault.
import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const output = process.env.CLIPPER_TEST_OUTPUT || path.join(tmpdir(), 'chatgpt-clipper-qa');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'profile-'));
const extension = path.resolve('dist');
const context = await chromium.launchPersistentContext(profile, {
	channel: 'chromium', headless: true, viewport: { width: 1100, height: 850 },
	args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const errors = [];
const consoleErrors = [];
try {
	const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
	const page = await context.newPage();
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => {
		// The intentionally unavailable external fixture image generates a resource error.
		if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) consoleErrors.push(message.text());
	});
	const fixture = await readFile(new URL('../src/providers/chatgpt/__tests__/fixtures/browser.html', import.meta.url), 'utf8');
	await context.route('https://**/*', route => route.request().url().startsWith('https://chatgpt.com/')
		? route.fulfill({ contentType: 'text/html', body: fixture }) : route.abort());
	await page.goto('https://chatgpt.com/c/synthetic-test');
	assert.equal(await page.title(), 'Synthetic ChatGPT capture');
	await page.locator('#selected').evaluate(el => {
		const range = document.createRange(); range.selectNodeContents(el);
		const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
		document.dispatchEvent(new MouseEvent('mouseup'));
	});
	// Simulate the loss of live selection on popup focus before content.js is loaded.
	await page.evaluate(() => window.getSelection().removeAllRanges());
	const tabId = await worker.evaluate(async () => {
		const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
		await chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['content.js'] });
		return tabs[0].id;
	});
	await worker.evaluate(id => chrome.tabs.sendMessage(id, { action: 'toggle-iframe' }), tabId);
	const panel = page.frameLocator('#obsidian-clipper-iframe');
	await panel.locator('#chatgpt-scope').waitFor();
	assert.equal(await panel.locator('#chatgpt-scope').inputValue(), 'selection');
	assert.match(await panel.locator('#note-content-field').inputValue(), /\*\*chosen text\*\*/);
	assert.doesNotMatch(await panel.locator('#note-content-field').inputValue(), /outside selection/);
	await page.screenshot({ path: path.join(output, 'selection.png') });
	await panel.locator('#note-name-field').fill('Edited title');
	await panel.locator('#path-name-field').fill('Clips/QA');
	await panel.locator('#chatgpt-scope').selectOption('answer');
	await panel.locator('#note-content-field').evaluate(async el => {
		for (let n = 0; n < 100 && !el.value.includes('outside selection'); n++) await new Promise(r => setTimeout(r, 20));
	});
	const answer = await panel.locator('#note-content-field').inputValue();
	assert.match(answer, /outside selection/);
	assert.match(answer, /```typescript\nconst x = 1;\n\n  run\(x\);\n```/);
	assert.match(answer, /\$E = mc\^2\$/);
	assert.equal(await panel.locator('#note-name-field').inputValue(), 'Edited title');
	assert.equal(await panel.locator('#path-name-field').inputValue(), 'Clips/QA');
	await panel.locator('#note-content-field').fill(answer + '\n\nManual edit');
	await panel.locator('#note-content-field').evaluate(el => { el.scrollTop = 0; });
	await page.screenshot({ path: path.join(output, 'answer.png') });
	assert.match(await panel.locator('[role="status"]').innerText(), /不保证离线/);
	// Narrow extension surface: preview and save control must remain usable.
	await page.locator('#obsidian-clipper-container').evaluate(el => { el.style.width = '350px'; el.style.height = '540px'; });
	await page.waitForTimeout(150);
	const layout = await panel.locator('#clip-btn').evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, height: innerHeight,
		preview: document.getElementById('note-content-field').getBoundingClientRect().height }));
	assert.ok(layout.bottom <= layout.height && layout.preview > 30, JSON.stringify(layout));
	await page.screenshot({ path: path.join(output, 'compact.png') });
	// Updating the selected DOM must reject a stale snapshot, never capture a neighbor.
	await page.locator('#selected').evaluate(el => { el.textContent = 'replacement'; });
	const stale = await worker.evaluate(id => chrome.tabs.sendMessage(id, { action: 'getPageContent' }), tabId);
	assert.match(stale.chatgptError, /重新选择/);
	await page.locator('[data-message-author-role="user"] p').evaluate(el => {
		const range = document.createRange(); range.selectNodeContents(el);
		const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
		document.dispatchEvent(new MouseEvent('mouseup'));
	});
	const user = await worker.evaluate(id => chrome.tabs.sendMessage(id, { action: 'getPageContent' }), tabId);
	assert.match(user.chatgptError, /同一条助手/);
	assert.deepEqual(errors, []);
	assert.deepEqual(consoleErrors, []);
	console.log(JSON.stringify({ passed: true, browser: context.browser()?.version(), url: page.url(), viewport: page.viewportSize(), output, checks: ['MV3 load', 'pre-injection selection cache', 'selection default', 'answer switch', 'code/math', 'title/path preservation', 'editable preview', 'warnings', 'no uncaught page errors'] }, null, 2));
} finally {
	await context.close();
}
