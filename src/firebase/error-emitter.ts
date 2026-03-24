
import { EventEmitter } from 'events';

// This is a simple event emitter that can be used to broadcast errors
// from anywhere in the application.
// We use the 'events' package, a standard Node.js module, which works in the browser.
export const errorEmitter = new EventEmitter();
