/*
Write a scraper written in google apps script that parses this public JSON data feed and serves it as an ATOM feed.
JSON URL: https://securityupdates.mattermost.com/security_updates.json
The url for the website is https://mattermost.com/security-updates/

`updated` of each `entry` is set based on the JSON data, or is undefined if no date is avaliable. Parse the date and convert with toISOString().
Ensure data from all fields are included in the `summary` text.

Handle schema changes in the json as gracefully as possible (handle missing fields in data, check types of data fields)
*/


// @ts-check
/// <reference types="@types/google-apps-script"/>
"use strict";

// Mock some Google Apps Scripts functions when running locally

/** @type string */
let scriptURL;
/** @type {function(String, {headers?: Record<String, String>}=): string} */
let fetchText;
/** @type {function(String): string | any} */
let outputText
/** @type {function(String): string | any} */
let outputHTML;

if (globalThis?.process?.env?.NODE_ENV === 'development') {
  const syncRequest = require('sync-request');
  fetchText = (url, params) => syncRequest("GET", url, params).getBody().toString();
  outputText = (data) => data;
  outputHTML = (html) => html;
  scriptURL = 'https://example.com';
} else {
  fetchText = (url, params) => UrlFetchApp.fetch(url, params ?? {}).getContentText();
  outputText = (data) => { console.log(data); return ContentService.createTextOutput(data) };
  outputHTML = (html) => HtmlService.createHtmlOutput(html);
  scriptURL = ScriptApp.getService().getUrl();
}

/**
 * Generates an Atom feed XML string.
 *
 * @param {Object} metadata - The feed metadata.
 * @param {string} metadata.title - The title of the feed.
 * @param {string} metadata.link - The link to the feed.
 * @param {string} metadata.updated - The last updated date of the feed in ISO 8601 format.
 * @param {string} metadata.id - The unique identifier for the feed.
 * @param {Object[]} entries - An array of entry objects for the feed.
 * @param {string} entries[].title - The title of the entry.
 * @param {string} [entries[].link] - The URL of the entry.
 * @param {string} entries[].id - The unique identifier for the entry.
 * @param {string} [entries[].updated] - The last updated date of the entry in ISO 8601 format.
 * @param {string} [entries[].summary] - The summary or description of the entry.
 * @returns {string} The generated Atom feed XML string.
 */
function atomfeed(metadata, entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <author>
       <name>Generated</name>
    </author>
    <title>${xmlescape(metadata.title)}</title>
    <link rel="self" type="application/atom+xml" href="${xmlescape(scriptURL)}" />
    <link rel="alternate" type="text/html" href="${xmlescape(metadata.link)}" />
    <updated>${xmlescape(metadata.updated)}</updated>
    <id>${xmlescape(metadata.id)}</id>
    ${entries.map(entry => `
      <entry>
        <id>${xmlescape(entry.id)}</id>
        <title>${xmlescape(entry.title)}</title>
        <updated>${xmlescape(entry.updated || metadata.updated)}</updated>
        <link href="${xmlescape(entry.link || metadata.link)}" />
        ${entry.summary ? `<summary>${xmlescape(entry.summary)}</summary>` : ''}
      </entry>
    `).join('')}
  </feed>
  `;
}

/** @type {function(String): String} */
function xmlescape(text) {
  return text.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return '';
    }
  });
}
/** @param {GoogleAppsScript.Events.DoGet=} e */
function doGet(e) {
  // default to atom for local testing, but in a webpp deployment default to HTML
  if (e?.parameter && e.parameter.feed != 'atom') {
    return outputHTML(
      `<!doctype html>
      <a href="https://feedly.com/i/subscription/feed/${encodeURIComponent(scriptURL + "?feed=atom")}" target="_top">Subscribe with Feedly</a><br>
      <a href="${scriptURL}?feed=atom" target="_top">Raw ATOM feed</a>`
    );
  }

  const feedMetadata = {
    dataUrl: 'https://api.example.com/data.json', // TODO
    title: 'Example Security Updates / whatever', // TODO
    link: 'https://example.com/security-updates/', // TODO
    updated: new Date().toISOString(),
    id: scriptURL,
  }

  let responseText;
  try {
    responseText = fetchText(feedMetadata.dataUrl);
    const data = JSON.parse(responseText);
    const dataEntries = data; // TODO: set to data.entries or similar, or data if top level array

    let entries = dataEntries.map(dataEntry => {
      // TODO parse entry, check types of each field used from data (e.g. use Array.isArray()), and handle missing fields. Skip `typeof ... === string` checks.

      // TODO if any required fields are missing, throw an exception that the data can't be parsed and include the serialized json of the entry.
      // TODO only throw an error for REQUIRED fields, if possible generate a partial entry with the available fields.

      let summary = '';

      let updated;
      const parsedDate = new Date(dataEntry.TODO); // TODO: extract date from field in dataEntry, use alternate parsing function if needed, do not use any libraries
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        updated = parsedDate.toISOString();
      }

      const ALL_EXPECTED_FIELDS = ['TODO', 'TODO', 'TODO']; // TODO, list of top level fields in the data entry
      const unexpectedFields = Object.keys(dataEntry).filter(field => !ALL_EXPECTED_FIELDS.includes(field));
      const missingFields = ALL_EXPECTED_FIELDS.filter(field => !Object.keys(dataEntry).includes(field));
      if (unexpectedFields.length || missingFields.length) {
        // Put error message at the end of summary
        summary += `\n\nUnexpected fields: ${unexpectedFields.join(', ')}, missing fields: ${missingFields.join(', ')}`;
      }

      return {
        title, // TODO, generate from data, include any existing title, otherwise CVE id, etc.
        link, // TODO, omit if not available
        id, // TODO: must be a URI, if none available use scriptURL + '#' + internal id, CVE id, etc. Use encodeURIComponent() where needed
        updated, // TODO, omit if not available
        summary, // TODO
      }
    });

    entries = entries.filter(Boolean);
    entries.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

    const seenIds = new Set();
    const duplicateIds = new Set();
    for (const entry of entries) {
      if (!entry.id) {
        throw new Error(`Missing entry ID: ${JSON.stringify(entry)}`);
      }
      if (seenIds.has(entry.id)) {
        duplicateIds.add(entry.id);
      } else {
        seenIds.add(entry.id);
      }
    }
    if (duplicateIds.size > 0) {
      throw new Error(`Duplicate entry IDs found: ${Array.from(duplicateIds).join(', ')}`);
    }

    return outputText(atomfeed(feedMetadata, entries));
  } catch (error) {
    return outputText(atomfeed(feedMetadata, [{
      title: 'Error',
      id: scriptURL + '#error',
      summary: `Error generating feed from ${feedMetadata.dataUrl}\n\n${error.stack || error.message}\n\n${responseText || ""}`,
    }]));
  };
}

if (globalThis?.process?.env?.NODE_ENV === 'development') {
  console.log(doGet());
}