require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * Normalize phone (CRITICAL for TrackDrive)
 */
function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

/**
 * PING BUYER
 */
async function pingBuyer(lead) {
  const caller_id = normalizePhone(lead.caller_id);

  if (!caller_id) {
    throw new Error("Invalid caller_id");
  }

  const params = new URLSearchParams({
    trackdrive_number: process.env.TRACKDRIVE_NUMBER,
    traffic_source_id: process.env.TRAFFIC_SOURCE_ID,
    caller_id: caller_id
  });

  const url = `${process.env.TRACKDRIVE_PING_URL}?${params.toString()}`;

  console.log("PING URL:", url);

  const res = await axios.get(url);
  return res.data;
}

/**
 * POST LEAD
 */
async function postLead(lead, ping_id) {
  const payload = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    caller_id: normalizePhone(lead.caller_id),
    state: lead.state,
    ping_id: ping_id,
    trackdrive_number: process.env.TRACKDRIVE_NUMBER,
    traffic_source_id: process.env.TRAFFIC_SOURCE_ID,
    tcpa_opt_in: true
  };

  const res = await axios.post(
    process.env.TRACKDRIVE_POST_URL,
    payload,
    { headers: { "Content-Type": "application/json" } }
  );

  return res.data;
}

/**
 * MAIN ROUTE
 */
app.post("/submit-lead", async (req, res) => {
  try {
    const lead = req.body;

    console.log("RAW LEAD:", lead);

    // validation
    if (!lead.caller_id || !lead.first_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // 1️⃣ PING
    const ping = await pingBuyer(lead);

    if (!ping.success || !ping.buyers || ping.buyers.length === 0) {
      return res.json({
        success: false,
        message: "No buyers available",
        ping
      });
    }

    const ping_id = ping.try_all_buyers_ping_id;

    if (!ping_id) {
      return res.json({
        success: false,
        message: "Ping failed (no ping_id)",
        ping
      });
    }

    // 2️⃣ POST
    const post = await postLead(lead, ping_id);

    return res.json({
      success: true,
      message: "Lead submitted successfully",
      ping,
      post
    });

  } catch (err) {
    console.error("ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running: http://localhost:${process.env.PORT}`);
});