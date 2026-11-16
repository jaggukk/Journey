import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "journey_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

function equalSecrets(left, right) {
  return timingSafeEqual(digest(left), digest(right));
}

function parseCookies(header) {
  const cookies = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (!name) return;
      try {
        cookies[name] = decodeURIComponent(value);
      } catch (error) {
        cookies[name] = value;
      }
    });
  return cookies;
}

function signPayload(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSession(secret) {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      issuedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
    }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

function verifySession(token, secret) {
  if (!token || !secret) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = signPayload(payload, secret);
  if (!equalSecrets(signature, expected)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.role !== "admin") return false;
    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function isSecureRequest(request) {
  return Boolean(
    request.secure ||
      String(request.headers["x-forwarded-proto"] || "")
        .split(",")[0]
        .trim() === "https"
  );
}

function sessionCookie(request, value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

function requestAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

export function createAuth(options) {
  const opts = options || {};
  const password = String(
    opts.password !== undefined ? opts.password : process.env.JOURNEY_ADMIN_PASSWORD || ""
  );
  const passwordHash = String(
    opts.passwordHash !== undefined
      ? opts.passwordHash
      : process.env.JOURNEY_ADMIN_PASSWORD_HASH || ""
  ).toLowerCase();
  const sessionSecret = String(
    opts.sessionSecret !== undefined
      ? opts.sessionSecret
      : process.env.JOURNEY_SESSION_SECRET || password || passwordHash || ""
  );
  const allowLocalEditing =
    opts.allowLocalEditing !== undefined
      ? Boolean(opts.allowLocalEditing)
      : !process.env.VERCEL && process.env.NODE_ENV !== "production";
  const configured = Boolean(password || passwordHash);
  const attempts = new Map();

  function canEdit(request) {
    if (configured) {
      const cookies = parseCookies(request.headers.cookie);
      return verifySession(cookies[COOKIE_NAME], sessionSecret);
    }
    return allowLocalEditing;
  }

  function status(request) {
    return {
      canEdit: canEdit(request),
      adminConfigured: configured
    };
  }

  function requireEditor(request, response, next) {
    if (canEdit(request)) {
      next();
      return;
    }
    response.status(401).json({
      error: configured
        ? "Sign in as admin to make changes."
        : "Admin editing is not configured on this server."
    });
  }

  function isRateLimited(address) {
    const now = Date.now();
    const record = attempts.get(address);
    if (!record || record.resetAt <= now) {
      attempts.delete(address);
      return false;
    }
    return record.count >= MAX_LOGIN_ATTEMPTS;
  }

  function recordFailure(address) {
    const now = Date.now();
    const record = attempts.get(address);
    if (!record || record.resetAt <= now) {
      attempts.set(address, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
      record.count += 1;
    }
  }

  function passwordMatches(candidate) {
    if (passwordHash) {
      return equalSecrets(digest(candidate).toString("hex"), passwordHash);
    }
    return equalSecrets(candidate, password);
  }

  function login(request, response) {
    if (!configured || !sessionSecret) {
      response.status(503).json({ error: "Admin sign-in is not configured on this server." });
      return;
    }

    const address = requestAddress(request);
    if (isRateLimited(address)) {
      response.status(429).json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
      return;
    }

    const candidate = request.body && request.body.password;
    if (typeof candidate !== "string" || !candidate || !passwordMatches(candidate)) {
      recordFailure(address);
      response.status(401).json({ error: "That password is not correct." });
      return;
    }

    attempts.delete(address);
    response.setHeader(
      "Set-Cookie",
      sessionCookie(request, createSession(sessionSecret), SESSION_TTL_SECONDS)
    );
    response.json({ ok: true, canEdit: true });
  }

  function logout(request, response) {
    response.setHeader("Set-Cookie", [
      sessionCookie(request, "", 0),
      `journey_admin=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    ]);
    response.json({ ok: true, canEdit: false });
  }

  return {
    configured,
    canEdit,
    status,
    requireEditor,
    login,
    logout
  };
}
