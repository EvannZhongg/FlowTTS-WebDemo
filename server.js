const express = require('express');
const app = require('./backend/app');

// Keep the framework import in the deployment entrypoint so Vercel's Express
// detector can identify this project even though route creation lives in
// backend/app.js.
if (typeof express !== 'function') {
    throw new Error('Express failed to load');
}

module.exports = app;
