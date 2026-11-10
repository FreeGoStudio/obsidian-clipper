import { isChatGPTUrl } from './detect';
import { installSelectionCache } from './selection-snapshot';
import { captureSnapshot } from './capture';

export function captureChatGPT(doc: Document = document) {
	if (!isChatGPTUrl(doc.URL)) return undefined;
	const cache = installSelectionCache(doc)!;
	// Do not refresh a cached range here: a live Range can silently relocate when
	// React replaces nodes. Cache validation must run before any new snapshot.
	return captureSnapshot(cache.get());
}
