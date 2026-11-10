export function isChatGPTUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(url.hostname);
	} catch {
		return false;
	}
}
