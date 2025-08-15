# Add request queue system for handling concurrent landing page creation

## Current Behavior
The service currently processes landing page creation requests sequentially. Each request:
1. Launches a new Chromium browser instance
2. Completes the WordPress automation
3. Closes the browser

This means multiple simultaneous requests could cause resource exhaustion and failures.

## Proposed Enhancement
Implement a queue system to handle concurrent requests safely. Options include:

### Option 1: Simple Queue (Recommended for low volume)
- Add an in-memory queue using a library like `p-queue`
- Process requests sequentially but queue them
- Set max concurrency to 1-2 browser instances

### Option 2: Browser Pool
- Maintain 2-3 browser instances that stay open
- Reuse browsers across requests (faster response time)
- More complex but better for higher volume

### Option 3: Job Queue with Redis
- Use Bull or BullMQ for persistent job queue
- Better for production/scale
- Handles failures and retries

## Technical Details
- Current system: 2 CPUs, 3.8GB RAM
- Each Chromium instance uses ~100-300MB RAM
- Browser launch time adds ~1-2s per request

## Recommendation
For low-concurrency needs, Option 1 (simple queue) should be sufficient. This would prevent resource exhaustion while keeping the implementation simple.

## Example Implementation
```javascript
const PQueue = require('p-queue').default;
const queue = new PQueue({ concurrency: 2 });

app.post('/create-landing', async (req, res) => {
  const job = queue.add(() => createLandingPage(data));
  // Return job ID immediately, process async
});
```

## Related Files
- `src/server.js` - Main server file where queue would be implemented
- Current implementation at lines 222-268

## Labels
- enhancement
- performance