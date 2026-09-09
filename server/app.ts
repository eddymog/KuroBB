import { createRequestHandler } from "@react-router/express";
import express from "express";

export const app = express();

// The authenticated-user context (Phase 2, kurobb-design.md §07) gets set
// here via getLoadContext() once the session-cookie middleware exists.
app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
  }),
);
