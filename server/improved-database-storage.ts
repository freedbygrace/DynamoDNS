import { Pool } from 'pg';
import connectPg from 'connect-pg-simple';
import session from 'express-session';
import {
  User, InsertUser,
  Organization, InsertOrganization,
  Domain, InsertDomain,
  DnsRecord, InsertDnsRecord,
  Provider, InsertProvider,
  ApiToken, InsertApiToken,
  DnsHistory, InsertDnsHistory,
  Webhook, InsertWebhook,
  WebhookDeliveryLog, InsertWebhookDeliveryLog,
  DnsMetric, InsertDnsMetric,
  Group, InsertGroup,
  GroupMember, InsertGroupMember
} from '@shared/schema';
import { IStorage } from './storage';
import { randomUUID } from 'crypto';

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    const { pool } = require('./db');
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'user_sessions' 
    });
  }

  // ... keep all existing methods ...

  // Updated version of updateDnsRecord with better parameter handling
  async updateDnsRecord(id: string, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
    try {
      console.log(`Updating DNS record with ID: ${id}, data:`, JSON.stringify(recordData));
      
      // Use direct PostgreSQL for consistency with other methods
      const { pool } = await import('./db');
      
      // Filter out fields that don't exist in the database
      const { proxied, isAutoIP, providerId, ...validFields } = recordData as any;
      
      // Make all fields database-safe before proceeding
      const dbSafeFields: Record<string, any> = {};
      Object.entries(validFields).forEach(([key, value]) => {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        dbSafeFields[dbField] = value;
      });
      
      // Process isActive separately since it's a common toggle
      if (recordData.isActive !== undefined) {
        dbSafeFields['is_active'] = recordData.isActive;
      }
      
      // Add isAutoIP if present (maps to auto_update in database)
      if (isAutoIP !== undefined) {
        dbSafeFields['auto_update'] = isAutoIP;
      }
      
      // Always update last_updated timestamp
      dbSafeFields['last_updated'] = new Date().toISOString();
      
      // Simple case: Just update the timestamp
      if (Object.keys(dbSafeFields).length === 0) {
        console.log(`Simple update for record ${id} - just updating timestamp`);
        
        const simpleQueryText = `
          UPDATE dns_records 
          SET last_updated = NOW()
          WHERE id = $1
          RETURNING id, domain_id, name, type, content, ttl, priority,
            provider_record_id, is_active, auto_update, notes, last_updated, created_at
        `;
        
        const simpleResult = await pool.query(simpleQueryText, [id]);
        
        if (!simpleResult.rows || simpleResult.rows.length === 0) {
          console.log(`No record found with ID ${id} for simple update`);
          return undefined;
        }
        
        const simpleRecord = simpleResult.rows[0];
        console.log(`Updated record with simple query:`, simpleRecord);
        
        return {
          id: simpleRecord.id,
          domainId: simpleRecord.domain_id,
          name: simpleRecord.name,
          type: simpleRecord.type,
          content: simpleRecord.content,
          ttl: simpleRecord.ttl,
          priority: simpleRecord.priority,
          providerRecordId: simpleRecord.provider_record_id,
          isActive: simpleRecord.is_active,
          isAutoIP: simpleRecord.auto_update,
          notes: simpleRecord.notes,
          lastUpdated: simpleRecord.last_updated,
          createdAt: simpleRecord.created_at,
          proxied: null // Maintained for frontend compatibility
        };
      }
      
      // Complex case: Build a dynamic query with proper parameters
      console.log(`Complex update for record ${id} with fields:`, Object.keys(dbSafeFields));
      
      // Prepare the SET clause and parameters array
      let setClause = '';
      const params = [id]; // First parameter is always the ID
      let paramIndex = 2; // Start parameter indexing at 2
      
      // Build SET clause from all database-safe fields
      Object.entries(dbSafeFields).forEach(([dbField, value]) => {
        // Add to SET clause
        if (setClause) setClause += ', ';
        setClause += `${dbField} = $${paramIndex}`;
        params.push(value);
        paramIndex++;
      });
      
      // Complete query with RETURNING clause
      const complexQueryText = `
        UPDATE dns_records 
        SET ${setClause}
        WHERE id = $1
        RETURNING id, domain_id, name, type, content, ttl, priority,
          provider_record_id, is_active, auto_update, notes, last_updated, created_at
      `;
      
      console.log(`Executing update query with params:`, params);
      const result = await pool.query(complexQueryText, params);
      
      if (!result.rows || result.rows.length === 0) {
        console.log(`No record found with ID ${id} for complex update`);
        
        // As a last resort, try fetching the record to see if it exists
        const checkQuery = `SELECT * FROM dns_records WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [id]);
        
        if (checkResult.rows && checkResult.rows.length > 0) {
          console.error(`Record exists but update failed. Original update params:`, params);
          throw new Error(`Record exists but update failed. Check server logs for details.`);
        }
        
        return undefined;
      }
      
      const updatedRecord = result.rows[0];
      console.log(`Updated record with complex query:`, updatedRecord);
      
      // Map result to expected format
      return {
        id: updatedRecord.id,
        domainId: updatedRecord.domain_id,
        name: updatedRecord.name,
        type: updatedRecord.type,
        content: updatedRecord.content,
        ttl: updatedRecord.ttl,
        priority: updatedRecord.priority,
        providerRecordId: updatedRecord.provider_record_id,
        isActive: updatedRecord.is_active,
        isAutoIP: updatedRecord.auto_update,
        notes: updatedRecord.notes,
        lastUpdated: updatedRecord.last_updated,
        createdAt: updatedRecord.created_at,
        proxied: null // Maintained for frontend compatibility
      };
    } catch (error) {
      console.error("Error updating DNS record:", error);
      throw error;
    }
  }
}