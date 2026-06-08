/**
 * Quota Interceptor
 *
 * Automatically intercepts all API responses and updates quota display
 * No more polling! Quota is updated via API responses.
 */

(function() {
    'use strict';

    // Store original fetch
    const originalFetch = window.fetch;

    // Check if already initialized
    if (window.QuotaInterceptorInitialized) {
        return;
    }
    window.QuotaInterceptorInitialized = true;

    /**
     * Parse quota information from response
     */
    function parseQuotaFromResponse(response, data) {
        // Priority 1: Get from response headers
        const quotaFromHeaders = {
            daily: parseInt(response.headers.get('X-Quota-Daily')) || null,
            used: parseInt(response.headers.get('X-Quota-Used')) || null,
            remaining: parseInt(response.headers.get('X-Quota-Remaining')) || null
        };

        // If we have complete header data, use it
        if (quotaFromHeaders.daily !== null && quotaFromHeaders.used !== null && quotaFromHeaders.remaining !== null) {
            return quotaFromHeaders;
        }

        // Priority 2: Get from response body
        if (data && data.quota) {
            return {
                daily: parseInt(data.quota.daily) || 0,
                used: parseInt(data.quota.used) || 0,
                remaining: parseInt(data.quota.remaining) || 0
            };
        }

        return null;
    }

    /**
     * Process JSON response
     */
    async function processJsonResponse(response) {
        try {
            const data = await response.clone().json();
            const quota = parseQuotaFromResponse(response, data);

            if (quota) {
                updateQuotaDisplay(quota);
            }

            return data;
        } catch (error) {
            // Ignore JSON parse errors
            return null;
        }
    }

    /**
     * Process SSE stream response
     */
    async function processSseResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));

                            // Check for quota in SSE event
                            if (data.Type === 'quota' && data.quota) {
                                updateQuotaDisplay(data.quota);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('[QuotaInterceptor] SSE processing error:', error);
        }
    }

    /**
     * Update quota display
     */
    function updateQuotaDisplay(quotaData) {
        // Ensure data is valid
        if (!quotaData || typeof quotaData !== 'object') {
            return;
        }

        // Convert to numbers
        const quota = {
            daily: parseInt(quotaData.daily) || 0,
            used: parseInt(quotaData.used) || 0,
            remaining: parseInt(quotaData.remaining) || 0
        };

        // Log for debugging
        console.log('[QuotaInterceptor] Quota updated:', quota);

        // Update SupabaseAuthInject if available
        if (window.SupabaseAuthInject && window.SupabaseAuthInject.updateQuota) {
            try {
                window.SupabaseAuthInject.updateQuota(quota);
            } catch (error) {
                console.warn('[QuotaInterceptor] Failed to update quota via SupabaseAuthInject:', error);
            }
        }

        // Trigger custom event for other components
        try {
            window.dispatchEvent(new CustomEvent('quotaUpdated', {
                detail: quota,
                bubbles: true,
                cancelable: true
            }));
        } catch (error) {
            console.warn('[QuotaInterceptor] Failed to dispatch quotaUpdated event:', error);
        }
    }

    /**
     * Check if URL is our API
     */
    function isOurApi(url) {
        if (typeof url === 'string') {
            // Explicitly exclude third-party services (e.g., Supabase)
            if (url.includes('supabase.co')) {
                return false;
            }
            return url.includes('api.realtime-ai.chat') ||
                   url.includes('localhost:9000') ||
                   url.includes('127.0.0.1:9000');
        }
        return false;
    }

    /**
     * Process response
     */
    async function processResponse(response) {
        // Only process our API responses
        if (!isOurApi(response.url)) {
            return;
        }

        try {
            const contentType = response.headers.get('Content-Type') || '';

            if (contentType.includes('application/json')) {
                await processJsonResponse(response);
            } else if (contentType.includes('text/event-stream')) {
                await processSseResponse(response);
            }
        } catch (error) {
            console.warn('[QuotaInterceptor] Error processing response:', error);
        }
    }

    /**
     * Enhanced fetch with quota interception
     */
    window.fetch = async function(resource, init = {}) {
        // Call original fetch
        const response = await originalFetch(resource, init);

        // Only process our API responses (avoid unnecessary cloning)
        if (isOurApi(response.url)) {
            processResponse(response.clone()).catch(error => {
                console.warn('[QuotaInterceptor] Async processing error:', error);
            });
        }

        return response;
    };

    // Log initialization
    console.log('[QuotaInterceptor] ✅ Initialized - No more quota polling!');

    // Expose for debugging
    window.QuotaInterceptor = {
        version: '1.0.0',
        initialized: true,
        updateQuotaDisplay: updateQuotaDisplay
    };
})();
