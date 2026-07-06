#!/usr/bin/env node
/**
 * Lightweight reverse proxy: dev.ybb.local:<proxyPort> -> localhost:3000
 * Supports HTTP + WebSocket (Next.js HMR).
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "subdomain.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const SUBDOMAIN = process.env.SUBDOMAIN_HOST || config.subdomain;
const PROXY_PORT = Number(process.env.PROXY_PORT || config.proxyPort);
const TARGET = process.env.TARGET_URL || config.target;
const target = new URL(TARGET);

function isAllowedHost(hostHeader) {
  if (!hostHeader) return false;
  const host = hostHeader.split(":")[0].toLowerCase();
  return host === SUBDOMAIN.toLowerCase() || host === "localhost" || host === "127.0.0.1";
}

function proxyRequest(clientReq, clientRes) {
  const hostHeader = clientReq.headers.host || "";
  if (!isAllowedHost(hostHeader)) {
    clientRes.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" });
    clientRes.end(
      `Use http://${SUBDOMAIN}:${PROXY_PORT}/ (add hosts: 127.0.0.1 ${SUBDOMAIN})\n`
    );
    return;
  }

  const headers = { ...clientReq.headers, host: target.host };
  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: clientReq.url,
      method: clientReq.method,
      headers,
    },
    (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(clientRes);
    }
  );

  proxyReq.on("error", (err) => {
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    clientRes.end(`Bad gateway: ${err.message}\nIs the dev server running at ${TARGET}?\n`);
  });

  clientReq.pipe(proxyReq);
}

function proxyUpgrade(clientReq, clientSocket, head) {
  const hostHeader = clientReq.headers.host || "";
  if (!isAllowedHost(hostHeader)) {
    clientSocket.destroy();
    return;
  }

  const headers = { ...clientReq.headers, host: target.host };
  const proxyReq = http.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    path: clientReq.url,
    method: clientReq.method,
    headers,
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    clientSocket.write(
      `HTTP/1.1 ${proxyRes.statusCode ?? 101} ${proxyRes.statusMessage ?? "Switching Protocols"}\r\n` +
        Object.entries(proxyRes.headers)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (proxyHead.length) proxySocket.write(proxyHead);
    if (head.length) proxySocket.write(head);
    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);
  });

  proxyReq.on("error", () => clientSocket.destroy());
  proxyReq.end();
}

const server = http.createServer(proxyRequest);
server.on("upgrade", proxyUpgrade);

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[subdomain-proxy] http://${SUBDOMAIN}:${PROXY_PORT}/ -> ${TARGET}`);
  console.log(`[subdomain-proxy] hosts: 127.0.0.1 ${SUBDOMAIN}`);
});
