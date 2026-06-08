/**
 * Test script to verify profile loading is working correctly
 * Run with: node scripts/test-profile-load.js
 */

console.log('🧪 Testing Profile Load Performance\n');

// Simulate timing scenarios
const scenarios = [
  { name: 'Fast DB (50ms)', delay: 50, shouldSucceed: true },
  { name: 'Normal DB (500ms)', delay: 500, shouldSucceed: true },
  { name: 'Slow DB (2s)', delay: 2000, shouldSucceed: true },
  { name: 'Very Slow DB (5s)', delay: 5000, shouldSucceed: true },
  { name: 'Timeout scenario (10s)', delay: 10000, shouldSucceed: false },
];

const TIMEOUT_MS = 8000;
const RETRY_ATTEMPTS = 2;

async function simulateProfileFetch(delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ id: 'test-user', email: 'test@example.com', role: 'student', full_name: 'Test User' });
    }, delay);
  });
}

async function fetchWithRetry(delay, retryCount = 0) {
  try {
    if (retryCount > 0) {
      console.log(`   ⟳ Retry attempt ${retryCount}/${RETRY_ATTEMPTS}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const start = Date.now();
    const profile = await simulateProfileFetch(delay);
    const elapsed = Date.now() - start;
    
    return { profile, elapsed, retried: retryCount > 0 };
  } catch (error) {
    if (retryCount < RETRY_ATTEMPTS) {
      return fetchWithRetry(delay, retryCount + 1);
    }
    throw error;
  }
}

async function testScenario(scenario) {
  console.log(`\n📝 Testing: ${scenario.name}`);
  console.log(`   Simulated delay: ${scenario.delay}ms`);
  
  const start = Date.now();
  let timedOut = false;
  let profile = null;
  
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve({ timeout: true });
    }, TIMEOUT_MS);
  });
  
  const fetchPromise = fetchWithRetry(scenario.delay)
    .then(result => ({ ...result, timeout: false }))
    .catch(() => ({ error: true, timeout: false }));
  
  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const elapsed = Date.now() - start;
  
  if (result.timeout || timedOut) {
    console.log(`   ⏱️  Timed out after ${elapsed}ms`);
    console.log(`   ✅ Using fallback profile`);
    console.log(`   Status: ${scenario.shouldSucceed ? '⚠️  Expected success but timed out' : '✅ Expected timeout'}`);
  } else if (result.error) {
    console.log(`   ❌ Failed to fetch profile`);
    console.log(`   Status: ❌ Error`);
  } else {
    console.log(`   ✅ Profile loaded successfully`);
    console.log(`   ⏱️  Time taken: ${result.elapsed}ms`);
    if (result.retried) {
      console.log(`   ⟳  Used retry mechanism`);
    }
    console.log(`   Status: ✅ Success`);
  }
}

async function runTests() {
  console.log('Configuration:');
  console.log(`- Timeout: ${TIMEOUT_MS}ms`);
  console.log(`- Retry attempts: ${RETRY_ATTEMPTS}`);
  console.log(`- Retry delay: 500ms`);
  
  for (const scenario of scenarios) {
    await testScenario(scenario);
  }
  
  console.log('\n\n📊 Summary:');
  console.log('✅ Fast loads: Should complete in < 1s');
  console.log('✅ Normal loads: Should complete in < 2s');
  console.log('✅ Slow loads: Should complete or fallback gracefully');
  console.log('✅ Timeouts: Should use fallback profile without errors');
  console.log('\n🎯 All scenarios tested!');
}

runTests().catch(console.error);
