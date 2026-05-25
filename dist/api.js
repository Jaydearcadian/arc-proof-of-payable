import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assessFinanceability } from "./financeability.js";
import { hashProof } from "./hash.js";
import { composeProofOfPayable } from "./compose.js";
import { verifyProof } from "./verify.js";
const MAX_BODY_BYTES = 256_000;
const PUBLIC_DIR = new URL("../public/", import.meta.url);
const sendJson = (response, status, body) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body, null, 2));
};
const sendText = (response, status, body, contentType) => {
    response.writeHead(status, { "content-type": contentType });
    response.end(body);
};
const readJson = async (request) => new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
        if (tooLarge)
            return;
        body += chunk;
        if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
            tooLarge = true;
            reject(new Error("Request body too large"));
        }
    });
    request.on("end", () => {
        if (!body)
            return resolve({});
        try {
            resolve(JSON.parse(body));
        }
        catch {
            reject(new Error("Request body must be valid JSON"));
        }
    });
    request.on("error", reject);
});
const proofFromBody = (body) => {
    if (body && typeof body === "object" && "proof" in body) {
        return body.proof;
    }
    return body;
};
const handlePost = async (path, request) => {
    const body = await readJson(request);
    if (path === "/proofs/hash") {
        return { status: 200, body: { proofHash: hashProof(proofFromBody(body)) } };
    }
    if (path === "/proofs/verify") {
        const proof = proofFromBody(body);
        const expectedHash = body && typeof body === "object" && "expectedHash" in body
            ? body.expectedHash
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
        const proof = composeProofOfPayable(body);
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
const staticFile = async (path) => {
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
export const handleRequest = async (request, response) => {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        return sendJson(response, message === "Request body too large" ? 413 : 400, { error: message });
    }
};
