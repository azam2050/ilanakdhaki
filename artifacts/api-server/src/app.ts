import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
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
