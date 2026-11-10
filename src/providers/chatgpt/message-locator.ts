// Adapted from chatgpt-md-fab (MIT), ae9f010. See THIRD_PARTY_NOTICES.md.
export const USER = '[data-message-author-role="user"], [data-turn="user"], [data-user-message-bubble], [data-chatgpt-search-unit-key$=":user"], [data-content-search-unit-key$=":user"]';
const UNIT = '[data-chatgpt-search-unit-key$=":assistant"], [data-content-search-unit-key$=":assistant"]';
const MESSAGE = '[data-message-author-role="assistant"], [data-turn="assistant"]';
const CONTENT = '.markdown, [data-message-content], [data-markdown-text-style="assistant-message"], [data-markdown-copy="contents"]';
export function assistantAt(node: Node): Element | null {
	const el = node.nodeType === 1 ? node as Element : node.parentElement;
	if (!el || el.closest(USER)) return null;
	return el.closest(UNIT) || el.closest(MESSAGE)
		|| el.closest('[data-markdown-text-style="assistant-message"]')?.closest('[data-chatgpt-selection-message-id]')
		|| el.closest('[data-markdown-text-style="assistant-message"]');
}

export function contentRoots(answer: Element): Element[] {
	const roots = answer.matches(CONTENT) ? [answer] : Array.from(answer.querySelectorAll(CONTENT));
	return roots.length ? roots.filter(root => !root.closest('[hidden], [aria-hidden="true"]')
		&& !roots.some(other => other !== root && other.contains(root))) : [answer];
}

export function locateRange(range: Range): Element {
	const start = assistantAt(range.startContainer);
	const end = assistantAt(range.endContainer);
	if (!start || !end || start !== end || Array.from(start.querySelectorAll(USER)).some(el => range.intersectsNode(el))) {
		throw new Error('请选择同一条助手回答；暂不支持用户消息或跨消息选区。');
	}
	return start;
}
