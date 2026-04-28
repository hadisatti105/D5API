require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");

const app = express();

/**
 * Middleware
 */
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * Health check (important for Render uptime)
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Normalize phone (CRITICAL for TrackDrive)
 */
function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

/**
 * Validate lead input
 */
function validateLead(lead) {
  if (!lead) return "Missing payload";
  if (!lead.first_name) return "Missing first_name";
  if (!lead.caller_id) return "Missing caller_id";
  return null;
}

/**
 * TRACKDRIVE PING
 */
async function pingBuyer(lead) {
  const caller_id = normalizePhone(lead.caller_id);

  const params = new URLSearchParams({
    trackdrive_number: process.env.TRACKDRIVE_NUMBER,
    traffic_source_id: process.env.TRAFFIC_SOURCE_ID,
    caller_id
  });

  const url = `${process.env.TRACKDRIVE_PING_URL}?${params.toString()}`;

  console.log("PING:", url);

  const res = await axios.get(url, { timeout: 8000 });
  return res.data;
}

/**
 * TRACKDRIVE POST
 */
async function postLead(lead, ping_id) {
  const payload = {
    first_name: lead.first_name,
    last_name: lead.last_name || "",
    email: lead.email || "",
    caller_id: normalizePhone(lead.caller_id),
    state: lead.state || "",
    ping_id,
    trackdrive_number: process.env.TRACKDRIVE_NUMBER,
    traffic_source_id: process.env.TRAFFIC_SOURCE_ID,
    tcpa_opt_in: true
  };

  const res = await axios.post(
    process.env.TRACKDRIVE_POST_URL,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: 8000
    }
  );

  return res.data;
}

/**
 * MAIN ROUTE (PING → POST FLOW)
 */
app.post("/submit-lead", async (req, res) => {
  try {
    const lead = req.body;

    console.log("LEAD:", lead);

    // validation
    const error = validateLead(lead);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    // PING
    const ping = await pingBuyer(lead);

    if (
      !ping.success ||
      ping.status === "caller_number_suppressed" ||
      !ping.buyers?.length
    ) {
      return res.json({
        success: false,
        message: "Lead rejected or no buyers available",
        ping
      });
    }

    const ping_id = ping.try_all_buyers_ping_id;

    if (!ping_id) {
      return res.json({
        success: false,
        message: "Missing ping_id",
        ping
      });
    }

    // POST
    const post = await postLead(lead, ping_id);

    return res.json({
      success: true,
      message: "Lead accepted",
      ping,
      post
    });

  } catch (err) {
    console.error("ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
});

/**
 * 404 handler (prevents HTML JSON crash)
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});