/**
 * Tencent Cloud API Utility Module
 *
 * Handles TC3-HMAC-SHA256 signing and API calls
 */

const crypto = require('crypto');
const logger = require('./logger');
const https = require('https');

// Helper functions
const sha256 = (msg, enc = 'hex') =>
    crypto.createHash('sha256').update(msg).digest(enc);

const hmacSha256 = (msg, key, enc = 'hex') =>
    crypto.createHmac('sha256', key).update(msg).digest(enc);

const getTimestamp = () => Math.floor(Date.now() / 1000);

const getDate = (ts) => {
    const d = new Date(ts * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/**
 * Build TC3-HMAC-SHA256 signature for Tencent Cloud API
 * @param {string} service - Service name (e.g., 'trtc', 'hunyuan')
 * @param {string} host - API host (e.g., 'trtc.ai.tencentcloudapi.com')
 * @param {string} action - API action (e.g., 'TextToSpeech')
 * @param {string} region - Region (e.g., 'ap-beijing')
 * @param {string} version - API version (e.g., '2019-07-22')
 * @param {string} payload - JSON payload string
 * @param {string} secretId - Tencent Cloud Secret ID
 * @param {string} secretKey - Tencent Cloud Secret Key
 * @returns {Object} { authorization, timestamp, headers }
 */
function buildTC3Signature(service, host, action, region, version, payload, secretId, secretKey) {
    const timestamp = getTimestamp();
    const date = getDate(timestamp);

    logger.debug(`[Signature Debug] 开始构建签名 - Timestamp: ${timestamp}, Date: ${date}, Service: ${service}, Host: ${host}, Payload: ${payload}`);

    // 1. Canonical request
    const hashedPayload = sha256(payload);
    const canonicalRequest = [
        'POST',
        '/',
        '',
        `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`,
        'content-type;host;x-tc-action',
        hashedPayload
    ].join('\n');

    logger.debug(`[Signature Debug] Canonical Request - Hashed Payload: ${hashedPayload}`);
    if (canonicalRequest.length < 200) {
        logger.debug(`[Signature Debug] Canonical Request: ${canonicalRequest.replace(/\n/g, ' | ')}`);
    }

    // 2. String to sign
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = sha256(canonicalRequest);
    const stringToSign = [
        'TC3-HMAC-SHA256',
        timestamp,
        credentialScope,
        hashedCanonicalRequest
    ].join('\n');

    logger.debug(`[Signature Debug] String to Sign - Hashed Canonical Request: ${hashedCanonicalRequest}`);

    // 3. Calculate signature (intermediate keys must be raw Buffers, not hex)
    const secretDate = hmacSha256(date, `TC3${secretKey}`, null);
    const secretService = hmacSha256(service, secretDate, null);
    const secretSigning = hmacSha256('tc3_request', secretService, null);
    const signature = hmacSha256(stringToSign, secretSigning, 'hex');

    logger.debug(`[Signature Debug] 签名计算完成 - Signature: ${signature}`);

    // 4. Build Authorization header
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;

    return {
        authorization,
        timestamp,
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json; charset=utf-8',
            Host: host,
            'X-TC-Action': action,
            'X-TC-Version': version,
            'X-TC-Timestamp': timestamp.toString(),
            'X-TC-Region': region
        }
    };
}

/**
 * Call Tencent Cloud API
 * @param {string} service - Service name
 * @param {string} host - API host
 * @param {string} action - API action
 * @param {string} region - Region
 * @param {string} version - API version
 * @param {Object} params - Request parameters
 * @param {string} secretId - Tencent Cloud Secret ID
 * @param {string} secretKey - Tencent Cloud Secret Key
 * @returns {Promise<Object>} API response
 */
function callTencentAPI(service, host, action, region, version, params, secretId, secretKey) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(params);
        const { headers } = buildTC3Signature(service, host, action, region, version, payload, secretId, secretKey);

        const options = {
            hostname: host,
            port: 443,
            path: '/',
            method: 'POST',
            headers
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    if (response.Response.Error) {
                        // Log full error for debugging
                        logger.error('[Tencent API] Error response:', JSON.stringify(response.Response.Error, null, 2));
                        reject(new Error(response.Response.Error.Message || 'Tencent API Error'));
                    } else {
                        resolve(response.Response);
                    }
                } catch (error) {
                    logger.error('[Tencent API] Failed to parse response:', data);
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        req.write(payload);
        req.end();
    });
}

/**
 * Call Tencent Cloud API with streaming response (SSE)
 * @param {string} service - Service name
 * @param {string} host - API host
 * @param {string} action - API action
 * @param {string} region - Region
 * @param {string} version - API version
 * @param {Object} params - Request parameters
 * @param {Function} onChunk - Callback for each SSE chunk
 * @param {string} secretId - Tencent Cloud Secret ID
 * @param {string} secretKey - Tencent Cloud Secret Key
 * @returns {Promise<void>}
 */
function callTencentAPIStream(service, host, action, region, version, params, onChunk, secretId, secretKey) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(params);
        const { headers } = buildTC3Signature(service, host, action, region, version, payload, secretId, secretKey);

        const options = {
            hostname: host,
            port: 443,
            path: '/',
            method: 'POST',
            headers
        };

        const req = https.request(options, (res) => {
            let buffer = '';

            res.on('data', (chunk) => {
                buffer += chunk.toString();

                // Parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        try {
                            const data = JSON.parse(dataStr);
                            onChunk(data);
                        } catch (error) {
                            logger.error('[Tencent API SSE] Parse error:', error);
                        }
                    }
                }
            });

            res.on('end', () => {
                resolve();
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Stream request failed: ${error.message}`));
        });

        req.write(payload);
        req.end();
    });
}

/**
 * Call Tencent Cloud ASR Flash API (uses different signature method)
 * Flash API uses HMAC-SHA1 signature instead of TC3-HMAC-SHA256
 * @param {string} appId - Tencent Cloud App ID
 * @param {string} audioUrl - Audio file URL
 * @param {Object} params - Request parameters (engine_type, voice_format, etc.)
 * @param {string} secretId - Tencent Cloud Secret ID
 * @param {string} secretKey - Tencent Cloud Secret Key
 * @returns {Promise<Object>} API response
 */
function callFlashAPI(appId, audioUrl, params, secretId, secretKey) {
    return new Promise((resolve, reject) => {
        const timestamp = getTimestamp();

        // Build query parameters
        const queryParams = {
            ...params,
            secretid: secretId,
            timestamp
        };

        // Sort query parameters by key
        const sortedKeys = Object.keys(queryParams).sort();
        const queryString = sortedKeys
            .map(key => `${key}=${queryParams[key]}`)
            .join('&');

        // Build signature string
        const path = `/asr/flash/v1/${appId}`;
        const signatureString = `POSTasr.cloud.tencent.com${path}?${queryString}`;

        logger.info('[Flash API] Signature String:', signatureString);

        // Generate HMAC-SHA1 signature
        const signature = crypto
            .createHmac('sha1', secretKey)
            .update(signatureString)
            .digest('base64');

        logger.info('[Flash API] Generated Signature:', signature);

        // Download audio file
        https.get(audioUrl, (audioRes) => {
            const chunks = [];

            audioRes.on('data', (chunk) => {
                chunks.push(chunk);
            });

            audioRes.on('end', () => {
                const audioBuffer = Buffer.concat(chunks);

                // Make request to Flash API
                const options = {
                    hostname: 'asr.cloud.tencent.com',
                    port: 443,
                    path: `${path}?${queryString}`,
                    method: 'POST',
                    headers: {
                        Authorization: signature,
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': audioBuffer.length
                    }
                };

                const req = https.request(options, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const response = JSON.parse(data);

                            if (response.code !== 0) {
                                logger.error('[Flash API] Error response:', JSON.stringify(response, null, 2));
                                reject(new Error(response.message || 'Flash API Error'));
                            } else {
                                resolve(response);
                            }
                        } catch (error) {
                            logger.error('[Flash API] Failed to parse response:', data);
                            reject(new Error(`Failed to parse response: ${error.message}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(new Error(`Flash API request failed: ${error.message}`));
                });

                req.write(audioBuffer);
                req.end();
            });

            audioRes.on('error', (error) => {
                reject(new Error(`Failed to download audio: ${error.message}`));
            });
        });
    });
}

/**
 * Build WebSocket URL for Tencent Cloud Real-time ASR
 * @param {string} appId - Tencent Cloud App ID
 * @param {Object} params - Query parameters (engine_model_type, voice_format, etc.)
 * @param {string} secretId - Tencent Cloud Secret ID
 * @param {string} secretKey - Tencent Cloud Secret Key
 * @returns {string} Full WebSocket URL with signature
 */
function buildWebSocketASRUrl(appId, params, secretId, secretKey) {
    const timestamp = getTimestamp();
    const nonce = Date.now();
    const expired = timestamp + 86400; // 24小时过期

    // Build query parameters
    const queryParams = {
        ...params,
        secretid: secretId,
        timestamp,
        nonce,
        expired
    };

    // Sort query parameters by key
    const sortedKeys = Object.keys(queryParams).sort();
    const queryString = sortedKeys
        .map(key => `${key}=${queryParams[key]}`)
        .join('&');

    // Build signature string
    const path = `/asr/v2/${appId}`;
    const signatureString = `asr.cloud.tencent.com${path}?${queryString}`;

    logger.info('[WebSocket ASR] Signature String:', signatureString);

    // Generate HMAC-SHA1 signature
    const signature = crypto
        .createHmac('sha1', secretKey)
        .update(signatureString)
        .digest('base64');

    logger.info('[WebSocket ASR] Generated Signature:', signature);

    // URL encode signature
    const encodedSignature = encodeURIComponent(signature);

    // Return full WebSocket URL
    return `wss://asr.cloud.tencent.com${path}?${queryString}&signature=${encodedSignature}`;
}

module.exports = {
    buildTC3Signature,
    callTencentAPI,
    callTencentAPIStream,
    callFlashAPI,
    buildWebSocketASRUrl
};
