import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  buildCorsOriginCheck,
  clientIp,
  suspiciousPatternMiddleware,
} from "./lib/security";

const app: Express = express();

// Hide server fingerprinting
app.disable("x-powered-by");
app.set("trust proxy", 1);

// Lightweight health check — must respond <100ms with no external deps.
// Registered BEFORE all middleware to bypass helmet/cors/rate-limit.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

// Canonicalise www → apex (single-origin app).
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (host === "www.ilanakdhaki.com") {
    return res.redirect(301, `https://ilanakdhaki.com${req.originalUrl}`);
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

app.use((_req, res, next) => {
  res.removeHeader("Server");
  res.removeHeader("X-Powered-By");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin: buildCorsOriginCheck(),
    credentials: true,
  }),
);
app.use(cookieParser());

app.use("/api", (req, res, next) => {
  if (req.path === "/webhooks/salla") return next();
  return express.json({ limit: "1mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const ipKey = (req: Request) => ipKeyGenerator(clientIp(req));

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: "Too many requests" },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: "Too many authentication attempts" },
});

app.use("/api/auth", authLimiter);
app.use("/api", generalLimiter);

app.use("/api", suspiciousPatternMiddleware);

app.use("/api", router);

// ---------------------------------------------------------------------------
// Static frontend (single-origin deployment)
// ---------------------------------------------------------------------------
// In production we serve the built merchant-dashboard from the same origin
// as the API. This eliminates CORS, cross-origin cookie, and SSL friction.
// The frontend's `dist/public` is copied into the container alongside the
// API bundle. If it's missing (e.g. dev mode), we skip silently.
const FRONTEND_DIST = path.resolve(
  process.cwd(),
  "artifacts/merchant-dashboard/dist/public",
);

if (existsSync(FRONTEND_DIST)) {
  logger.info({ dir: FRONTEND_DIST }, "serving_frontend_static");

  // Hashed assets — long cache.
  app.use(
    "/assets",
    express.static(path.join(FRONTEND_DIST, "assets"), {
      immutable: true,
      maxAge: "1y",
      index: false,
    }),
  );

  // Other static files at root (favicon, robots, etc.) — short cache.
  app.use(
    express.static(FRONTEND_DIST, {
      index: false,
      maxAge: "1h",
    }),
  );

  // SPA fallback — anything not matched and not under /api/* serves index.html.
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    const indexPath = path.join(FRONTEND_DIST, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) next(err);
    });
  });
} else {
  logger.warn({ dir: FRONTEND_DIST }, "frontend_dist_missing");
}

// Production-safe error handler — never leak stack traces or internals.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, path: req.path }, "unhandled_error");
  if (res.headersSent) return;
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({ error: "Internal server error" });
  } else {
    res.status(500).json({ error: err.message });
  }
});

export default app;
