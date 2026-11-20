// Server-side example: Seedance 2.5 text-to-video through the official Higgsfield SDK.
// Run with `npm run seedance:example`. Never import this file from browser code.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, higgsfield } from '@higgsfield/client/v2';

const MODEL = 'bytedance/seedance-2.5/text-to-video';

const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.env.HF_CREDENTIALS) {
    console.error('HF_CREDENTIALS is not set. Add it to .env.local as KEY_ID:KEY_SECRET.');
    process.exit(1);
}

config({
    credentials: process.env.HF_CREDENTIALS,
    // The SDK keeps polling on statuses it does not treat as final (such as "canceled"),
    // so a bound turns a stuck request into a TimeoutError instead of a hang.
    maxPollTime: 15 * 60 * 1000,
    pollInterval: 5000,
});

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

    if (result.status === 'completed' && result.video?.url) {
        console.log(`Request ${result.request_id} completed.`);
        console.log(`Video URL: ${result.video.url}`);
    } else {
        const reasons = {
            nsfw: 'blocked by content moderation',
            failed: 'generation failed',
            canceled: 'request was canceled',
            completed: 'completed without a video URL',
        };
        const reason = reasons[result.status] ?? `ended with status "${result.status}"`;
        console.error(`Request ${result.request_id ?? '(no id)'}: ${reason}. No video was produced.`);
        process.exitCode = 1;
    }
} catch (error) {
    // Error messages from the SDK never include the credential value.
    console.error(`Seedance request failed: ${error.name}: ${error.message}`);
    process.exitCode = 1;
}
