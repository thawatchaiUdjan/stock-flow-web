// CI-only provider fixture. The API and PostgreSQL stay real; no email leaves the runner.
import { readFileSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import { createServer as httpsServer } from "node:https";

const [keyFile, certFile] = process.argv.slice(2);
const messages = [];
let fail = false;

httpsServer(
  { key: readFileSync(keyFile), cert: readFileSync(certFile) },
  async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v3/smtp/email") {
      response.writeHead(404).end();
      return;
    }
    if (fail) {
      response.writeHead(503).end();
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    messages.push(JSON.parse(Buffer.concat(chunks).toString()));
    response.writeHead(201, { "Content-Type": "application/json" }).end('{"messageId":"ci-only"}');
  },
).listen(443, "127.0.0.1");

httpServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "POST" && request.url === "/fail") {
    fail = true;
    response.writeHead(204).end();
  } else if (request.method === "POST" && request.url === "/resume") {
    fail = false;
    response.writeHead(204).end();
  } else if (request.method === "GET" && request.url === "/messages") {
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(messages));
  } else {
    response.writeHead(404).end();
  }
}).listen(8025, "127.0.0.1");
