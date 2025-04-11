// Script to test DNS record toggle functionality
import fetch from 'node-fetch';

async function testToggleRecord() {
  try {
    console.log('Starting DNS record toggle test...');
    
    // 1. Login to get authentication
    console.log('1. Authenticating...');
    const loginRes = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'password'
      }),
      credentials: 'include'
    });
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
    }
    
    const userData = await loginRes.json();
    console.log('Authentication successful:', userData.username);
    
    const cookieHeader = loginRes.headers.get('set-cookie');
    
    // 2. Get a list of DNS records
    console.log('2. Fetching DNS records...');
    const recordsRes = await fetch('http://localhost:5000/api/dns-records', {
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    if (!recordsRes.ok) {
      throw new Error(`Failed to fetch records: ${recordsRes.status} ${recordsRes.statusText}`);
    }
    
    const records = await recordsRes.json();
    if (records.length === 0) {
      throw new Error('No DNS records found to test with');
    }
    
    console.log(`Found ${records.length} DNS records`);
    const testRecord = records[0];
    console.log(`Using record for test: ${testRecord.id} (${testRecord.name}, ${testRecord.type})`);
    
    // 3. Toggle the record (flip the current isActive state)
    const newState = !testRecord.isActive;
    console.log(`3. Toggling record ${testRecord.id} to isActive=${newState}`);
    
    const toggleRes = await fetch(`http://localhost:5000/api/dns-records/${testRecord.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ isActive: newState })
    });
    
    if (!toggleRes.ok) {
      throw new Error(`Failed to toggle record: ${toggleRes.status} ${toggleRes.statusText}`);
    }
    
    const updatedRecord = await toggleRes.json();
    console.log('Toggle result:', updatedRecord);
    
    // 4. Verify the record's isActive state has changed
    if (updatedRecord.isActive === newState) {
      console.log(`✅ SUCCESS: Record toggled successfully to isActive=${newState}`);
    } else {
      throw new Error(`Record toggle failed: Expected isActive=${newState}, got isActive=${updatedRecord.isActive}`);
    }
    
    // 5. Toggle it back to original state
    console.log(`4. Toggling record back to original state isActive=${testRecord.isActive}`);
    
    const revertRes = await fetch(`http://localhost:5000/api/dns-records/${testRecord.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ isActive: testRecord.isActive })
    });
    
    if (!revertRes.ok) {
      throw new Error(`Failed to revert record: ${revertRes.status} ${revertRes.statusText}`);
    }
    
    const revertedRecord = await revertRes.json();
    
    // 6. Verify the record's isActive state has been reverted
    if (revertedRecord.isActive === testRecord.isActive) {
      console.log(`✅ SUCCESS: Record toggled back successfully to isActive=${testRecord.isActive}`);
    } else {
      throw new Error(`Record toggle back failed: Expected isActive=${testRecord.isActive}, got isActive=${revertedRecord.isActive}`);
    }
    
    console.log('Test completed successfully! The toggle functionality works as expected.');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
  }
}

testToggleRecord();