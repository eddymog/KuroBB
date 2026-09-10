import { createRequestHandler } from "@react-router/express";
import express from "express";

export const app = express();

// Render (and any single reverse-proxy PaaS) terminates HTTPS at its edge and
// forwards to this container over plain HTTP. Without this, Express derives
// req.protocol as "http" from the raw socket, so React Router's built-in
// action CSRF check (which compares the request's own reconstructed origin
// against the browser's real `Origin: https://...` header) sees a protocol
// mismatch and rejects every POST with 400 — reads work, writes don't. Only
// showed up in production: there's no proxy in front of local dev to cause
// the mismatch. `1` trusts exactly one hop (Render's own proxy), not an
// arbitrary chain.
app.set("trust proxy", 1);

// The authenticated-user context (Phase 2, kurobb-design.md §07) gets set
// here via getLoadContext() once the session-cookie middleware exists.
app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
  }),
);
