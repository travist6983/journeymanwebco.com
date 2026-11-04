// Ross Towing preview: every switch in one place. Change a value, commit, push, and GitHub Pages
// redeploys in about a minute. Nothing here is secret: all of it ships to the browser.
export const CONFIG = {
  // ---- Forms ----
  // A form service endpoint (Formspree, Basin, Web3Forms or similar). Empty means nothing is sent:
  // the form shows "please call 248-356-6011 or email us" and keeps what the visitor typed.
  // TODO: set once Jennifer confirms who receives freight quotes (question 1 in UPDATE_NOTES).
  FORM_ENDPOINT_FREIGHT: "",

  // Tow request form, used in TOWBOOK_MODE "none". Same pattern as freight.
  // TODO: set once Jennifer confirms who receives tow requests.
  FORM_ENDPOINT_TOW: "",

  // How the forms post: "json" (Formspree, Basin and Web3Forms all take it) or "form" (urlencoded).
  FORM_ENCODING: "json",

  // Fields some services want in every post. Web3Forms example: { access_key: "your-public-key" }.
  FORM_EXTRA_FIELDS: {},

  // TODO: the office email address for quotes and tow requests. Used for the "email us" link in the
  // fallback message. Empty shows an [OFFICE EMAIL] placeholder. The address that actually receives
  // form posts is set in the form service's dashboard, not here.
  CONTACT_EMAIL: "",

  // ---- Towbook (see README.md, "Towbook") ----
  TOWBOOK_MODE: "none",   // "none" | "link" | "embed"
  TOWBOOK_URL: "",        // a Towbook hosted request or payment page, once confirmed. TODO
  // TODO: Jennifer is sending a sample Towbook QR. Save it as img/towbook-qr.png and set this to
  // "img/towbook-qr.png". Empty, or a missing file, keeps the QR slot hidden.
  TOWBOOK_QR_SRC: "",

  // ---- Auction date (see README.md, "Auction date") ----
  // Option B only: a Google Sheet published to the web as CSV. Empty uses data/auction.json.
  // TODO: https://docs.google.com/spreadsheets/d/e/<id>/pub?gid=0&single=true&output=csv
  AUCTION_SHEET_CSV_URL: "",
};
