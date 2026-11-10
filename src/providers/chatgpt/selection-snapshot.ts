import { isChatGPTUrl } from './detect';
import { locateRange } from './message-locator';

export interface SelectionSnapshot {
	range: Range;
	start: Node;
	end: Node;
	startOffset: number;
	endOffset: number;
	answer: Element;
	html: string;
	text: string;
	url: string;
	timestamp: number;
}

export class SelectionCache {
	private snapshot?: SelectionSnapshot;
	private error = '请先在同一条 ChatGPT 助手回答内选中文字，再打开摘录。';
	constructor(private doc: Document) {}
	clear(): void {
		this.snapshot = undefined;
		this.error = '请重新选择同一条助手回答内的内容。';
	}
	remember(selection = this.doc.getSelection()): void {
		// Toolbar focus can collapse the live selection. Keep the last valid snapshot.
		if (!selection || selection.isCollapsed || !selection.rangeCount) return;
		this.snapshot = undefined;
		try {
			if (selection.rangeCount !== 1) throw new Error('请选择同一条助手回答中的一个连续选区。');
			const range = selection.getRangeAt(0).cloneRange();
			const answer = locateRange(range);
			const holder = this.doc.createElement('div');
			holder.append(range.cloneContents());
			this.snapshot = { range, start: range.startContainer, end: range.endContainer,
				startOffset: range.startOffset, endOffset: range.endOffset, answer,
				html: holder.innerHTML, text: range.toString(), url: this.doc.URL, timestamp: Date.now() };
		} catch (error) {
			this.error = (error as Error).message;
		}
	}
	get(): SelectionSnapshot {
		const s = this.snapshot;
		if (!s) throw new Error(this.error);
		const holder = this.doc.createElement('div');
		holder.append(s.range.cloneContents());
		if (s.url !== this.doc.URL || !s.start.isConnected || !s.end.isConnected || !s.answer.isConnected
			|| s.range.startContainer !== s.start || s.range.endContainer !== s.end
			|| s.range.startOffset !== s.startOffset || s.range.endOffset !== s.endOffset
			|| holder.innerHTML !== s.html || locateRange(s.range) !== s.answer) {
			this.clear();
			throw new Error('页面或选区已变化，请重新选择内容。');
		}
		return s;
	}
}

declare global {
	interface Window { chatgptClipSelection?: SelectionCache; }
}

export function installSelectionCache(doc: Document = document): SelectionCache | undefined {
	if (!isChatGPTUrl(doc.URL)) return;
	const win = doc.defaultView!;
	if (win.chatgptClipSelection) return win.chatgptClipSelection;
	const cache = new SelectionCache(doc);
	win.chatgptClipSelection = cache;
	let timer: ReturnType<typeof setTimeout>;
	doc.addEventListener('selectionchange', () => {
		clearTimeout(timer);
		timer = setTimeout(() => cache.remember(), 40);
	});
	for (const event of ['mouseup', 'keyup']) doc.addEventListener(event, () => cache.remember());
	// A deliberate click in the page cancels an old selection; toolbar blur does not.
	doc.addEventListener('pointerdown', event => {
		if (!(event.target as Element)?.closest?.('#obsidian-clipper-container')) cache.clear();
	});
	win.addEventListener('pagehide', () => cache.clear());
	cache.remember();
	return cache;
}
