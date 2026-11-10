import { ChatGPTClipResult, ClipScope, warningMessages } from './types';

export function renderChatGPTControls(clip: ChatGPTClipResult | undefined, onChange: (scope: ClipScope) => Promise<void>): void {
	document.getElementById('chatgpt-controls')?.remove();
	if (!clip) return;
	const host = document.createElement('section');
	host.id = 'chatgpt-controls';
	const label = document.createElement('label');
	label.htmlFor = 'chatgpt-scope'; label.textContent = 'ChatGPT 摘录范围 ';
	const select = document.createElement('select'); select.id = 'chatgpt-scope';
	for (const [value, text] of [['selection', '仅选中内容'], ['answer', '整条回答']]) {
		const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
	}
	select.value = clip.scope;
	select.addEventListener('change', async () => {
		select.disabled = true;
		try { await onChange(select.value as ClipScope); }
		finally { select.disabled = false; }
	});
	const warnings = document.createElement('p'); warnings.setAttribute('role', 'status');
	warnings.textContent = clip.warnings.map(code => warningMessages[code]).join(' ');
	const hint = document.createElement('small'); hint.textContent = '切换范围会重新生成正文预览；保存前请检查并编辑。';
	host.append(label, select, hint, warnings);
	document.querySelector('.clipper')?.prepend(host);
}
