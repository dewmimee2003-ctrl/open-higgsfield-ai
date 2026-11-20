// Server-side example: Seedance 2.5 text-to-video through the official Higgsfield SDK.
// Run with `npm run seedance:example`. Never import this file from browser code.
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { config, higgsfield } from '@higgsfield/client/v2';

const MODEL = 'bytedance/seedance-2.5/text-to-video';

dotenv.config({
    path: fileURLToPath(new URL('../../.env.local', import.meta.url)),
    quiet: true,
});

const credentials = process.env.HF_CREDENTIALS;
if (!credentials) {
    console.error('HF_CREDENTIALS is not set. Add it to .env.local as KEY_ID:KEY_SECRET.');
    process.exit(1);
}

config({
    credentials,
    // The SDK keeps polling on statuses it does not treat as final (such as "canceled"),
    // so a bound turns a stuck request into a TimeoutError instead of a hang.
    maxPollTime: 15 * 60 * 1000,
    pollInterval: 5000,
});

const FAILURE_REASONS: Record<string, string> = {
    nsfw: 'blocked by content moderation',
    failed: 'generation failed',
    canceled: 'request was canceled',
    completed: 'completed without a video URL',
};

try {
    const result = await higgsfield.subscribe(MODEL, {
        input: {
            prompt: 'A cinematic scene at sunset',
            duration: 5,
            resolution: '720p',
            aspect_ratio: '16:9',
        },
        withPolling: true,
    });

    const videoUrl = result.video?.url;
    if (result.status === 'completed' && videoUrl) {
        console.log(`Request ${result.request_id} completed.`);
        console.log(`Video URL: ${videoUrl}`);
    } else {
        const reason = FAILURE_REASONS[result.status] ?? `ended with status "${result.status}"`;
        console.error(`Request ${result.request_id ?? '(no id)'}: ${reason}. No video was produced.`);
        process.exitCode = 1;
    }
} catch (error) {
    // Error messages from the SDK never include the credential value.
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Seedance request failed: ${err.name}: ${err.message}`);
    process.exitCode = 1;
}
