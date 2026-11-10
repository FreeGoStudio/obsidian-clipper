export type ClipScope = 'selection' | 'answer';
export type ClipWarningCode = 'selection-expanded-to-math' | 'selection-expanded-to-table'
	| 'unsupported-rich-content' | 'external-image-url' | 'missing-formula-source'
	| 'incomplete-dom' | 'citation-target-unavailable';

export interface ChatGPTClipResult {
	provider: 'chatgpt';
	scope: ClipScope;
	markdown: string;
	selectionMarkdown: string;
	answerMarkdown: string;
	sourceUrl: string;
	conversationTitle: string;
	selectedText: string;
	warnings: ClipWarningCode[];
	selectionWarnings: ClipWarningCode[];
	answerWarnings: ClipWarningCode[];
}

export const warningMessages: Record<ClipWarningCode, string> = {
	'selection-expanded-to-math': '公式局部选区已扩展为完整公式。',
	'selection-expanded-to-table': '表格局部选区已扩展为完整表格。',
	'unsupported-rich-content': '存在无法完整转换的富内容；已尽量保留可用文字，请检查原对话。',
	'external-image-url': '图片仅保留外部链接，可能需要登录或已过期，不保证离线可用。',
	'missing-formula-source': '未找到公式源，已降级为可见文本。',
	'incomplete-dom': '回答可能仍在生成、折叠或未完整加载，请检查原对话。',
	'citation-target-unavailable': '引用缺少可获取的目标链接，仅保留引用文字。',
};

export function withScope(clip: ChatGPTClipResult, scope: ClipScope): ChatGPTClipResult {
	return { ...clip, scope, markdown: scope === 'answer' ? clip.answerMarkdown : clip.selectionMarkdown,
		warnings: scope === 'answer' ? clip.answerWarnings : clip.selectionWarnings };
}
