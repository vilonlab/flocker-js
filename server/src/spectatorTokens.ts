import { randomBytes } from 'node:crypto';

/**
 * Short-lived, single-use tokens that authorize a spectator WebSocket join for one specific room.
 *
 * The admin room-list page lives behind the oauth2-proxy gate (see deploy/nginx-flocker.conf), but
 * the game's WebSocket endpoint (/flocker/app/) is public and ungated -- so a spectator join can't
 * be trusted just because the client passed `{ spectator: true }`. Minting a token here (only ever
 * called from the gated /admin/api/rooms route) and requiring it in the room's onAuth keeps the
 * actual trust boundary at the reverse-proxy gate, consistent with how the rest of /admin/ works.
 */

interface TokenEntry {
    roomId: string;
    expiresAt: number;
}

const TOKEN_TTL_MS = 60_000;
const tokens = new Map<string, TokenEntry>();

function purgeExpired() {
    const now = Date.now();
    tokens.forEach((entry, token) => {
        if (entry.expiresAt <= now) {
            tokens.delete(token);
        }
    });
}

export function mintSpectatorToken(roomId: string): string {
    purgeExpired();

    const token = randomBytes(24).toString('hex');
    tokens.set(token, { roomId, expiresAt: Date.now() + TOKEN_TTL_MS });

    return token;
}

// Single-use: a valid token is consumed (removed) the moment it's checked, whether or not it matched.
export function consumeSpectatorToken(token: string, roomId: string): boolean {
    purgeExpired();

    const entry = tokens.get(token);
    tokens.delete(token);

    return entry !== undefined && entry.roomId === roomId;
}
