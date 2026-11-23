"use strict";

const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { MongoClient } = require("mongodb");
const { rateLimit } = require("express-rate-limit");

const required = ["MONGODB_URI", "SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD", "FRONTEND_ORIGIN"];
for (const key of required) {
  if (!process.env[key] || !process.env[key].trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
if (process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}
if (process.env.ADMIN_PASSWORD.length < 12) {
  throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const frontendOrigin = process.env.FRONTEND_ORIGIN.replace(/\/$/, "");
const allowedOrigins = new Set([
  frontendOrigin,
  "https://gfamous133-hub.github.io",
  "https://gfamous-entertainment-api.onrender.com",
  process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "") : ""
].filter(Boolean));
const port = Number(process.env.PORT || 10000);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Allow non-browser/server requests and the exact GFAMOUS site/API origins only.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS."));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "32kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const client = new MongoClient(process.env.MONGODB_URI);
let listings;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: "Admin sign-in required." });
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

app.use(session({
  name: "gfamous_admin_session",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    client,
    dbName: process.env.MONGODB_DB_NAME || "gfamous_entertainment",
    collectionName: "admin_sessions",
    ttl: 60 * 60 * 8,
    autoRemove: "native"
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public"), {
  index: false,
  maxAge: isProduction ? "1h" : 0
}));

app.get("/validation-key.txt", (_req, res) => {
  res.type("text/plain").send("89230434dd31bc1d7171b454f86478c133a34a14f35e7d204c5674f6a2fb46b2026d67224e3ac58ab2fb69a94ab65ee9e0db844a1dda1d800fc3b011ae34409d");
});

app.get("/privacy-policy", (_req, res) => res.sendFile(path.join(__dirname, "public", "privacy-policy.html")));
app.get("/terms-of-service", (_req, res) => res.sendFile(path.join(__dirname, "public", "terms-of-service.html")));

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/creator", (_req, res) => res.sendFile(path.join(__dirname, "public", "creator.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "GFAMOUS Entertainment API" });
});

app.post("/api/submissions", submitLimiter, async (req, res, next) => {
  try {
    const type = cleanText(req.body.type, 20).toLowerCase();
    const title = cleanText(req.body.title, 100);
    const creatorName = cleanText(req.body.creatorName, 100);
    const description = cleanText(req.body.description, 1500);
    const mediaUrl = cleanText(req.body.mediaUrl, 1000);
    const rightsDetails = cleanText(req.body.rightsDetails, 1000);
    const rightsConfirmed = req.body.rightsConfirmed === true;

    if (!["movie", "series", "music"].includes(type)) {
      return res.status(400).json({ error: "Choose movie, series or music." });
    }
    if (title.length < 2 || creatorName.length < 2 || description.length < 10) {
      return res.status(400).json({ error: "Complete the title, creator name and description." });
    }
    if (mediaUrl && !validHttpsUrl(mediaUrl)) {
      return res.status(400).json({ error: "Media link must use HTTPS." });
    }
    if (!rightsConfirmed || rightsDetails.length < 10) {
      return res.status(400).json({ error: "Confirm your distribution rights and explain them." });
    }

    const now = new Date();
    const record = {
      type, title, creatorName, description, mediaUrl, rightsDetails,
      status: "pending",
      submittedAt: now,
      updatedAt: now
    };
    const result = await listings.insertOne(record);
    return res.status(201).json({
      message: "Submission received for review. It is not published yet.",
      id: result.insertedId
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/listings", async (_req, res, next) => {
  try {
    const approved = await listings.find(
      { status: "approved" },
      { projection: { title: 1, type: 1, creatorName: 1, description: 1, mediaUrl: 1, submittedAt: 1 } }
    ).sort({ submittedAt: -1 }).limit(100).toArray();
    res.json({ listings: approved });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/login", loginLimiter, async (req, res, next) => {
  try {
    const username = cleanText(req.body.username, 100);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!safeEqual(username, process.env.ADMIN_USERNAME) || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
      return res.status(401).json({ error: "Username or password is incorrect." });
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.admin = true;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.json({ authenticated: true });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: req.session?.admin === true });
});

app.post("/api/admin/logout", requireAdmin, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("gfamous_admin_session", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax"
    });
    res.json({ loggedOut: true });
  });
});

app.get("/api/admin/pending", requireAdmin, async (_req, res, next) => {
  try {
    const pending = await listings.find({ status: "pending" }).sort({ submittedAt: 1 }).limit(100).toArray();
    res.json({ submissions: pending });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/submissions/:id", requireAdmin, async (req, res, next) => {
  try {
    const { ObjectId } = require("mongodb");
    const status = cleanText(req.body.status, 20).toLowerCase();
    const reviewNote = cleanText(req.body.reviewNote, 500);
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be approved or rejected." });
    }
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid submission ID." });
    }
    const result = await listings.updateOne(
      { _id: new ObjectId(req.params.id), status: "pending" },
      { $set: { status, reviewNote, updatedAt: new Date() } }
    );
    if (!result.matchedCount) {
      return res.status(404).json({ error: "Pending submission not found." });
    }
    res.json({ updated: true, status });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error("GFAMOUS API error:", error.message);
  if (res.headersSent) return;
  const status = error.message.includes("Origin not allowed") ? 403 : 500;
  res.status(status).json({ error: status === 403 ? "Request origin is not allowed." : "Server error. Please try again later." });
});

async function start() {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "gfamous_entertainment");
  listings = db.collection("content_submissions");
  await listings.createIndex({ status: 1, submittedAt: -1 });
  app.listen(port, () => {
    console.log(`GFAMOUS Entertainment API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Could not start GFAMOUS backend:", error.message);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await client.close().catch(() => {});
  process.exit(0);
});
