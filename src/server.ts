import { createServer } from "node:http";

import { handleRequest } from "./api.js";

const port = Number(process.env.PORT ?? 8787);

createServer(handleRequest).listen(port, "127.0.0.1", () => {
  console.log(`Arc Proof of Payable listening on http://127.0.0.1:${port}`);
});
