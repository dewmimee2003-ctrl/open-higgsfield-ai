// Client for models served directly by the Higgsfield API (https://api.higgsfield.ai).
// In dev, requests go through the Vite proxy at /higgsfield to avoid CORS.

const API_HOST = 'https://api.higgsfield.ai';
const DEV_PREFIX = '/higgsfield';

const TERMINAL_FAILURES = {
    failed: 'Generation failed',
    nsfw: 'Generation blocked by the content filter (nsfw)',
    canceled: 'Generation was canceled',
};

export class HiggsfieldClient {
    constructor() {
        this.baseUrl = import.meta.env.DEV ? DEV_PREFIX : API_HOST;
    }

    getKey() {
        const key = localStorage.getItem('higgsfield_key');
        if (!key) throw new Error('Higgsfield API key missing. Add it in Settings.');
        return key;
    }

    headers(key) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Key ${key}`,
        };
    }

    // The API returns absolute status URLs; in dev they must go through the proxy too.
    resolveUrl(url) {
        if (!import.meta.env.DEV || !url.startsWith(API_HOST)) return url;
        return DEV_PREFIX + url.slice(API_HOST.length);
    }

    /**
     * Submits a generation request and polls until it reaches a terminal state.
     * @param {string} endpoint - Model ID, e.g. "kling-video/v4.0/text-to-video"
     * @param {Object} input - Request body as documented for the model
     * @returns {Promise<Object>} The completed status payload, with `url` set to the video URL
     */
    async generate(endpoint, input, { interval = 5000, timeoutMs = 20 * 60 * 1000 } = {}) {
        const key = this.getKey();
        const url = `${this.baseUrl}/${endpoint}`;

        console.log('[Higgsfield] Requesting:', url, input);

        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers(key),
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Higgsfield request failed: ${response.status} - ${errText.slice(0, 120)}`);
        }

        const submitted = await response.json();
        console.log('[Higgsfield] Submit response:', submitted);

        if (submitted.status === 'completed') {
            return { ...submitted, id: submitted.request_id, url: submitted.video?.url };
        }
        if (!submitted.status_url) throw new Error('Higgsfield response had no status_url');

        const result = await this.pollStatus(submitted.status_url, key, interval, timeoutMs);
        return { ...result, id: result.request_id, url: result.video?.url };
    }

    async pollStatus(statusUrl, key, interval, timeoutMs) {
        const pollUrl = this.resolveUrl(statusUrl);
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, interval));

            const response = await fetch(pollUrl, { headers: this.headers(key) });
            if (!response.ok) {
                // Transient server errors are retried; anything else is fatal.
                if (response.status >= 500) continue;
                const errText = await response.text();
                throw new Error(`Higgsfield status check failed: ${response.status} - ${errText.slice(0, 120)}`);
            }

            const data = await response.json();
            console.log('[Higgsfield] Status:', data.status);

            if (data.status === 'completed') return data;
            if (TERMINAL_FAILURES[data.status]) {
                const detail = data.error ? `: ${data.error}` : '';
                throw new Error(`${TERMINAL_FAILURES[data.status]}${detail}`);
            }
        }

        throw new Error('Higgsfield generation timed out.');
    }
}

export const higgsfield = new HiggsfieldClient();
