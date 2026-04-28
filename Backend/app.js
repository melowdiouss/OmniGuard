const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "mock-secret-for-demo-only";
const PORT = Number(process.env.PORT || 3000);

const store = {
  usersByEmail: new Map(),
  records: [],
  scans: [],
};

const counters = {
  user: 1,
  record: 1,
  scan: 1,
};

function makeId(prefix) {
  const counterKey = prefix === "usr" ? "user" : prefix === "rec" ? "record" : "scan";
  const value = counters[counterKey];
  counters[counterKey] += 1;
  return `${prefix}_${String(value).padStart(3, "0")}`;
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "driver" || value === "logistics") {
    return "LOGISTICS";
  }
  return "BRAND";
}

function makeTxHash() {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

function sendError(response, statusCode, message, code) {
  return response.status(statusCode).json({
    error: {
      message,
      code,
    },
  });
}

function ensureUser(email, role) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const existing = store.usersByEmail.get(normalizedEmail);
  if (existing) {
    return existing;
  }

  const user = {
    id: makeId("usr"),
    email: normalizedEmail,
    role,
    orgId: "org_demo_001",
    displayName: role === "LOGISTICS" ? "Transit Driver" : "Brand Operator",
  };

  store.usersByEmail.set(normalizedEmail, user);
  return user;
}

function createSession(email, roleInput) {
  const role = normalizeRole(roleInput);
  const fallbackEmail =
    role === "LOGISTICS" ? "driver.demo@omniguard.app" : "brand.demo@omniguard.app";
  const user = ensureUser(email || fallbackEmail, role);

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  return {
    user,
    accessToken,
    refreshToken: accessToken,
  };
}

function authMiddleware(request, response, next) {
  const authorization = request.get("authorization") || "";
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];

  if (!token) {
    return sendError(response, 401, "Authorization header required", "UNAUTHORIZED");
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.auth = payload;
    return next();
  } catch (error) {
    return sendError(response, 401, "Invalid demo token", "INVALID_TOKEN");
  }
}

function requireRoles(...roles) {
  return (request, response, next) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      return sendError(response, 403, "Insufficient role for this action", "FORBIDDEN");
    }
    return next();
  };
}

function findRecordByPacketCode(packetCode) {
  return store.records.find((record) => record.packetCode === packetCode) || null;
}

function buildScanResult(scan, record) {
  const shared = {
    scanId: scan.scanId,
    recordId: record.recordId,
    packetCode: record.packetCode,
    scannedAt: scan.scannedAt,
  };

  if (scan.demoScenario === "flag") {
    return {
      ...shared,
      status: "flagged",
      decision: "HOLD",
      aiConfidence: 0.97,
      reasons: [
        "Label fingerprint mismatch detected",
        "Seal edge shows tamper suspicion",
      ],
      recommendedAction: "Escalate for manual review",
    };
  }

  return {
    ...shared,
    status: "verified",
    decision: "PASS",
    aiConfidence: 0.98,
    reasons: [
      "Label fingerprint matched",
      "No tamper markers detected",
    ],
    recommendedAction: "Continue delivery",
  };
}

function toHistoryItem(scan) {
  const record = store.records.find((item) => item.recordId === scan.recordId);
  const result = scan.result || (record ? buildScanResult(scan, record) : null);
  if (!result) {
    return null;
  }

  return {
    scanId: scan.scanId,
    recordId: scan.recordId,
    packetCode: scan.packetCode,
    status: result.status,
    decision: result.decision,
    aiConfidence: result.aiConfidence,
    reasons: result.reasons,
    recommendedAction: result.recommendedAction,
    scannedAt: scan.scannedAt,
    demoScenario: scan.demoScenario,
  };
}

app.get("/health", (request, response) => {
  response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    records: store.records.length,
    scans: store.scans.length,
  });
});

app.post("/api/v1/auth/register", (request, response) => {
  const session = createSession(request.body?.email, request.body?.role);
  response.status(201).json({ data: session });
});

app.post("/api/v1/auth/login", (request, response) => {
  const session = createSession(request.body?.email, request.body?.role);
  response.json({ data: session });
});

app.get("/api/v1/auth/me", authMiddleware, (request, response) => {
  response.json({
    data: {
      id: request.auth.sub,
      email: request.auth.email,
      role: request.auth.role,
      orgId: request.auth.orgId,
    },
  });
});

app.get("/api/v1/brand/blockchain/records", authMiddleware, (request, response) => {
  response.json({
    data: {
      items: store.records.slice().reverse(),
    },
  });
});

app.post(
  "/api/v1/brand/blockchain/records",
  authMiddleware,
  requireRoles("BRAND"),
  (request, response) => {
    const createdAt = request.body?.capturedAt || new Date().toISOString();
    const productCode = request.body?.productCode || "PRODUCT-DEMO-001";
    const packetCode = request.body?.packetCode || "PACKET-DEMO-001";
    const productImageUri = request.body?.productImageUri || "demo://sample-image";

    const record = {
      recordId: makeId("rec"),
      productCode,
      packetCode,
      productImageUri,
      blockchainTxHash: makeTxHash(),
      status: "registered",
      createdAt,
      createdByUserId: request.auth.sub,
      orgId: request.auth.orgId,
      timelineLabel: "Registered on ledger",
    };

    store.records.push(record);

    return response.status(201).json({
      data: record,
    });
  },
);

app.post(
  "/api/v1/logistics/scans",
  authMiddleware,
  requireRoles("LOGISTICS"),
  (request, response) => {
    const packetCode = request.body?.packetCode;
    const demoScenario = request.body?.demoScenario === "flag" ? "flag" : "pass";
    const record = findRecordByPacketCode(packetCode);

    if (!packetCode) {
      return sendError(response, 400, "packetCode is required", "INVALID_REQUEST");
    }

    if (!record) {
      return sendError(
        response,
        404,
        "No registered ledger record found for this packet code",
        "RECORD_NOT_FOUND",
      );
    }

    const scan = {
      scanId: makeId("scan"),
      recordId: record.recordId,
      packetCode,
      demoScenario,
      scannedAt: new Date().toISOString(),
      status: "queued",
      scannedByUserId: request.auth.sub,
    };

    store.scans.push(scan);

    return response.status(202).json({
      data: {
        scanId: scan.scanId,
        recordId: scan.recordId,
        packetCode: scan.packetCode,
        status: "queued",
        message: "Scan queued for AI validation",
        demoScenario,
      },
    });
  },
);

app.get(
  "/api/v1/logistics/scans/:scanId/result",
  authMiddleware,
  requireRoles("LOGISTICS"),
  (request, response) => {
    const scan = store.scans.find((item) => item.scanId === request.params.scanId);
    if (!scan) {
      return sendError(response, 404, "Scan not found", "SCAN_NOT_FOUND");
    }

    const record = store.records.find((item) => item.recordId === scan.recordId);
    if (!record) {
      return sendError(response, 404, "Associated record not found", "RECORD_NOT_FOUND");
    }

    scan.result = buildScanResult(scan, record);
    scan.status = scan.result.status;

    return response.json({
      data: scan.result,
    });
  },
);

app.get(
  "/api/v1/logistics/scans/history",
  authMiddleware,
  requireRoles("LOGISTICS"),
  (request, response) => {
    response.json({
      data: {
        items: store.scans
          .slice()
          .reverse()
          .map(toHistoryItem)
          .filter(Boolean),
      },
    });
  },
);

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mock Backend server listening at http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
