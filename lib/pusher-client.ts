import PusherClient from 'pusher-js';

// Use fallbacks to prevent prerendering errors during next build when env vars are missing
export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || 'dummy_key', {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
});
