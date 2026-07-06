import { EventEmitter } from 'node:events';

class WebSocketEmitter extends EventEmitter {}

export const wsEmitter = new WebSocketEmitter();
