import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import { Webhook } from '@shared/schema';

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
 * Delivers a webhook payload to the configured URL with retry capability
 */
export async function deliverWebhook(
  webhook: Webhook, 
  payload: any, 
  maxRetries = 3,
  initialRetryDelay = 2000
): Promise<WebhookDeliveryResult> {
  let retryCount = 0;
  let lastError: Error | null = null;
  
  // Generate HMAC signature if webhook has a secret
  const signature = webhook.secret ? generateSignature(payload, webhook.secret) : '';
  
  while (retryCount <= maxRetries) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'DNS-Manager-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Event': payload.event
      };
      
      // Add signature header if available
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: 10000 // 10 second timeout
      });
      
      const responseText = await response.text();
      
      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          message: 'Webhook delivered successfully',
          timestamp: new Date(),
          responseBody: responseText,
          retryCount
        };
      } else {
        lastError = new Error(`HTTP error ${response.status}: ${responseText}`);
        
        // If we got a response but it's an error, check if it's a 5xx error that warrants retrying
        if (response.status < 500 || retryCount >= maxRetries) {
          break; // Don't retry client errors or if we've exhausted retries
        }
      }
    } catch (error) {
      lastError = error as Error;
    }
    
    // Exponential backoff for retries
    const delay = initialRetryDelay * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    retryCount++;
  }
  
  return {
    success: false,
    statusCode: lastError && 'statusCode' in lastError ? (lastError as any).statusCode : undefined,
    message: lastError ? lastError.message : 'Unknown error delivering webhook',
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