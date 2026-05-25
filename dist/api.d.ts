import type { IncomingMessage, ServerResponse } from "node:http";
export declare const handleRequest: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
