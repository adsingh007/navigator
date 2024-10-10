"use strict";
const { google } = require("googleapis");
const nconf = require('nconf');

// Load configurations from environment variables or command-line arguments
nconf.argv().env();

// Get the Google Sheet document ID from environment variables
const docId = nconf.get("docId") || nconf.get("DOC_ID");
console.log("Working with docId:", docId);

// Set the Sheets API version
const sheetsVersion = "v4";
const reqURL = `https://sheets.googleapis.com/${sheetsVersion}/spreadsheets/${docId}`;

// Function to get entries from the Google Sheet
const getEntries = async (sheetName) => {
    const gauth = await google.auth.getClient({
        scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/devstorage.read_only"
        ]
    });

    try {
        // Make the API request to get values from the specified sheet
        const rsp = await gauth.request({
            url: `${reqURL}/values/${sheetName}!A:B`,
            majorDimension: "COLUMNS"
        });

        if (rsp && rsp.data && rsp.data.values) {
            return rsp.data.values;
        } else {
            console.log("getEntries: No values returned");
            return null;
        }
    } catch (err) {
        console.log("getEntries: Caught error", err);
        return null;
    }
};

// Main function to handle URL shortening logic
exports.getLink = async (req, res) => {
    const gauth = await google.auth.getClient({
        scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/devstorage.read_only"
        ]
    });

    // Get the sheet name from environment variables
    let sName = nconf.get("sheetName") || nconf.get("SHEET_NAME");

    // Fetch the entries from the Google Sheet
    let entries = await getEntries(sName);

    // Default URL in case no match is found
    let defURL = nconf.get("DEFAULT_URL") || "https://www.wikipedia.org";

    if (entries != null) {
        console.log("Iterating", entries.length, "items, looking for", req.url);

        // Extract the base path (strip query parameters and fragments)
        let requestUrl = decodeURIComponent(req.url).split('?')[0];

        // Check if the request URL matches any entry in the Google Sheet
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                if (entries[i] != null && entries[i][0] === requestUrl) {
                    let redirectUrl = entries[i][1].startsWith('http') ? entries[i][1] : `http://${entries[i][1]}`;
                    console.log("Redirecting to", redirectUrl);
                    res.redirect(302, redirectUrl);
                    return;
                }
            }
        }
    } else {
        console.log("No entries, redirecting to default URL");
    }

    // If no match is found, redirect to the default URL
    res.redirect(302, defURL);
};
