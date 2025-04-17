import EventEmitter from 'events';
import uWebSockets from 'uWebSockets.js';
import { Client, ClientPrivate, ClientState, ISendOptions } from '@colyseus/core';
export declare class uWebSocketWrapper extends EventEmitter {
    ws: uWebSockets.WebSocket<any>;
    constructor(ws: uWebSockets.WebSocket<any>);
}
export declare enum ReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
}
export declare class uWebSocketClient implements Client, ClientPrivate {
    id: string;
    _ref: uWebSocketWrapper;
    sessionId: string;
    state: ClientState;
    readyState: number;
    reconnectionToken: string;
    _enqueuedMessages: any[];
    _afterNextPatchQueue: any;
    _reconnectionToken: string;
    _joinedAt: number;
    constructor(id: string, _ref: uWebSocketWrapper);
    get ref(): uWebSocketWrapper;
    set ref(_ref: uWebSocketWrapper);
    sendBytes(type: string | number, bytes: Buffer | Uint8Array, options?: ISendOptions): void;
    send(messageOrType: any, messageOrOptions?: any | ISendOptions, options?: ISendOptions): void;
    enqueueRaw(data: Uint8Array | Buffer, options?: ISendOptions): void;
    raw(data: Uint8Array | Buffer, options?: ISendOptions, cb?: (err?: Error) => void): void;
    error(code: number, message?: string, cb?: (err?: Error) => void): void;
    leave(code?: number, data?: string): void;
    close(code?: number, data?: string): void;
    toJSON(): {
        sessionId: string;
        readyState: number;
    };
}
