import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import { Webhook } from '@shared/schema';

// Constants for the retry mechanism
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 2000; // 2 seconds
const DEFAULT_MAX_DELAY = 60000; // 60 seconds
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Generates a signature for a webhook payload using the webhook's secret
export function generateSignature(payload: any, secret: string): string {
  if (!secret) return '';
  
  const hmac = createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Interface for webhook delivery results
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  message: string;
  timestamp: Date;
  responseBody?: string;
  retryCount?: number;
}

// Interface for webhook delivery logs
export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  signature: string;
  result: WebhookDeliveryResult;
  createdAt: Date;
}

/**
 * Options for webhook delivery
 */
export interface WebhookDeliveryOptions {
  startRetryCount?: number;  // For continuing retry attempts from previous failures
  maxRetries?: number;       // Maximum number of retry attempts
  initialDelayMs?: number;   // Initial delay in milliseconds between retries
  maxDelayMs?: number;       // Maximum delay between retries
  timeoutMs?: number;        // Request timeout in milliseconds
  jitter?: boolean;          // Add random jitter to delay to avoid thundering herd
}

/**
 * Delivers a webhook payload to the configured URL with exponential backoff retry
 */
export async function deliverWebhook(
  webhook: Webhook, 
  payload: any,
  options: WebhookDeliveryOptions = {}
): Promise<WebhookDeliveryResult> {
  // Set defaults for options
  const retryOptions = {
    startRetryCount: options.startRetryCount || 0,
    maxRetries: options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MAX_RETRIES,
    initialDelayMs: options.initialDelayMs || DEFAULT_INITIAL_DELAY,
    maxDelayMs: options.maxDelayMs || DEFAULT_MAX_DELAY,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT,
    jitter: options.jitter !== undefined ? options.jitter : true
  };
  
  let retryCount = retryOptions.startRetryCount;
  let lastError: Error | null = null;
  
  // Generate HMAC signature if webhook has a secret
  const signature = webhook.secret ? generateSignature(payload, webhook.secret) : '';
  
  // Add retry count information to the payload if this is a retry
  const isRetry = retryCount > 0;
  const retryPayload = isRetry ? { ...payload, _retryCount: retryCount } : payload;
  
  // Log the current retry attempt
  console.log(`${isRetry ? 'Retrying' : 'Delivering'} webhook ${webhook.id} (attempt ${retryCount + 1})`);
  
  while (retryCount <= retryOptions.maxRetries) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'DNS-Manager-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Event': payload.event || 'unknown'
      };
      
      // Add signature header if available
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }
      
      // Add retry information if this is a retry attempt
      if (isRetry) {
        headers['X-Webhook-Retry-Count'] = retryCount.toString();
      }
      
      // Make the actual HTTP request to deliver the webhook
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), retryOptions.timeoutMs);
      
      try {
        // Use node-fetch with proper typing
        const fetchOptions: RequestInit & { signal?: AbortSignal } = {
          method: 'POST',
          headers,
          body: JSON.stringify(retryPayload),
          signal: controller.signal
        };
        
        const response = await fetch(webhook.url, fetchOptions);
        
        clearTimeout(timeoutId);
        const responseText = await response.text();
        
        if (response.ok) {
          // Successful delivery
          return {
            success: true,
            statusCode: response.status,
            message: isRetry ? 
              `Webhook delivered successfully after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}` : 
              'Webhook delivered successfully',
            timestamp: new Date(),
            responseBody: responseText,
            retryCount
          };
        } else {
          lastError = new Error(`HTTP error ${response.status}: ${responseText}`);
          
          // Don't retry 4xx client errors (except 429 Too Many Requests)
          if ((response.status >= 400 && response.status < 500 && response.status !== 429) || 
              retryCount >= retryOptions.maxRetries) {
            break;
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        lastError = fetchError as Error;
        
        // Network errors and timeouts are generally retriable
        console.error(`Webhook delivery error (will retry): ${lastError.message}`);
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`Unexpected error in webhook delivery: ${lastError.message}`);
    }
    
    // If we've hit max retries, break out
    if (retryCount >= retryOptions.maxRetries) {
      break;
    }
    
    // Calculate the next delay with exponential backoff
    let delay = retryOptions.initialDelayMs * Math.pow(2, retryCount);
    
    // Cap the delay at the maximum allowed
    delay = Math.min(delay, retryOptions.maxDelayMs);
    
    // Add jitter (±25%) to avoid thundering herd problem if many webhooks retry at once
    if (retryOptions.jitter) {
      const jitterFactor = 0.75 + (Math.random() * 0.5); // Random between 0.75 and 1.25
      delay = Math.floor(delay * jitterFactor);
    }
    
    console.log(`Waiting ${delay}ms before retry #${retryCount + 1} for webhook ${webhook.id}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    retryCount++;
  }
  
  return {
    success: false,
    statusCode: lastError && 'statusCode' in lastError ? (lastError as any).statusCode : undefined,
    message: lastError ? 
      `Failed to deliver webhook after ${retryCount} ${retryCount === 1 ? 'attempt' : 'attempts'}: ${lastError.message}` : 
      'Unknown error delivering webhook',
    timestamp: new Date(),
    retryCount
  };
}

/**
 * Creates a verification helper for clients to validate webhook signatures
 */
export function createSignatureVerifier(secret: string) {
  return {
    verify: (signature: string, payload: any): boolean => {
      return signature === generateSignature(payload, secret);
    }
  };
}