import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { assessFinanceability } from "./financeability.js";
import { hashProof } from "./hash.js";
import { composeProofOfPayable } from "./compose.js";
import { verifyProof } from "./verify.js";
import type { Hex, ProofOfPayable } from "./types.js";

const MAX_BODY_BYTES = 256_000;
const PUBLIC_DIR = new URL("../public/", import.meta.url);

type ApiResponse = {
  status: number;
  body: unknown;
};

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
};

const sendText = (response: ServerResponse, status: number, body: string, contentType: string) => {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
};

const readJson = async (request: IncomingMessage): Promise<unknown> => new Promise((resolve, reject) => {
  let body = "";
  let tooLarge = false;
  request.setEncoding("utf8");
  request.on("data", (chunk: string) => {
    if (tooLarge) return;
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      tooLarge = true;
      reject(new Error("Request body too large"));
    }
  });
  request.on("end", () => {
    if (!body) return resolve({});
    try {
      resolve(JSON.parse(body) as unknown);
    } catch {
      reject(new Error("Request body must be valid JSON"));
    }
  });
  request.on("error", reject);
});

const proofFromBody = (body: unknown): ProofOfPayable => {
  if (body && typeof body === "object" && "proof" in body) {
    return (body as { proof: ProofOfPayable }).proof;
  }
  return body as ProofOfPayable;
};

const handlePost = async (path: string, request: IncomingMessage): Promise<ApiResponse> => {
  const body = await readJson(request);
  if (path === "/proofs/hash") {
    return { status: 200, body: { proofHash: hashProof(proofFromBody(body)) } };
  }
  if (path === "/proofs/verify") {
    const proof = proofFromBody(body);
    const expectedHash = body && typeof body === "object" && "expectedHash" in body
      ? (body as { expectedHash?: Hex }).expectedHash
      : undefined;
    return { status: 200, body: verifyProof(proof, expectedHash) };
  }
  if (path === "/proofs/financeability") {
    return {
      status: 200,
      body: {
        ...assessFinanceability(proofFromBody(body)),
        trust: "self_asserted",
        warning: "Financeability is structural only; verify source systems, signatures, and Arc transaction state before underwriting."
      }
    };
  }
  if (path === "/proofs/compose") {
    const proof = composeProofOfPayable(body as never);
    return {
      status: 200,
      body: {
        proof,
        verification: verifyProof(proof),
        financeability: {
          ...assessFinanceability(proof),
          trust: "self_asserted",
          warning: "Financeability is structural only; verify source systems, signatures, and Arc transaction state before underwriting."
        }
      }
    };
  }
  return { status: 404, body: { error: "Not found" } };
};

const staticFile = async (path: string): Promise<{ status: number; body: string; type: string }> => {
  const file = path === "/" ? "index.html" : path.slice(1);
  if (!["index.html", "styles.css", "app.js"].includes(file)) {
    return { status: 404, body: "Not found", type: "text/plain; charset=utf-8" };
  }
  const type = file.endsWith(".css")
    ? "text/css; charset=utf-8"
    : file.endsWith(".js")
      ? "application/javascript; charset=utf-8"
      : "text/html; charset=utf-8";
  return { status: 200, body: await readFile(join(PUBLIC_DIR.pathname, file), "utf8"), type };
};

export const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true, service: "arc-proof-of-payable" });
    }
    if (request.method === "GET") {
      const result = await staticFile(url.pathname);
      return sendText(response, result.status, result.body, result.type);
    }
    if (request.method === "POST") {
      const result = await handlePost(url.pathname, request);
      return sendJson(response, result.status, result.body);
    }
    return sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return sendJson(response, message === "Request body too large" ? 413 : 400, { error: message });
  }
};
