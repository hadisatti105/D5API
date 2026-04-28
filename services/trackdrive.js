const axios = require("axios");

const PING_URL = process.env.TRACKDRIVE_PING_URL;
const POST_URL = process.env.TRACKDRIVE_POST_URL;

const TRACKDRIVE_NUMBER = process.env.TRACKDRIVE_NUMBER;
const TRAFFIC_SOURCE_ID = process.env.TRAFFIC_SOURCE_ID;

/**
 * STEP 1: PING TrackDrive for buyer availability
 */
async function pingBuyer() {
  const url = `${PING_URL}?trackdrive_number=${encodeURIComponent(TRACKDRIVE_NUMBER)}&traffic_source_id=${TRAFFIC_SOURCE_ID}`;

  const response = await axios.get(url);
  return response.data;
}

/**
 * STEP 2: POST lead to buyer
 */
async function postLead(lead, ping_id) {
  const payload = {
    ...lead,
    ping_id,
    trackdrive_number: TRACKDRIVE_NUMBER,
    traffic_source_id: TRAFFIC_SOURCE_ID,
    tcpa_opt_in: true
  };

  const response = await axios.post(POST_URL, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return response.data;
}

module.exports = {
  pingBuyer,
  postLead
};