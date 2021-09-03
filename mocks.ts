// Mock some Google Apps Scripts when running locally

// @ts-ignore
import { default as syncRequest} from 'sync-request';

function urlFetchAppFetch(url: string, params?: object) {
    return UrlFetchApp.fetch(url, params).getContentText();
}

function syncRequestFetch(url: string, params?: object) {
    return syncRequest("GET", url, params).getBody().toString();
}

function contentServiceJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function devJSON(data) {
    return JSON.stringify(data, null, 2);
}

export const fetch = typeof process !== "undefined" && process.env.NODE_ENV === 'development' ?  syncRequestFetch : urlFetchAppFetch;
export const outputJSON = typeof process !== "undefined" && process.env.NODE_ENV === 'development' ?  devJSON : contentServiceJSON;