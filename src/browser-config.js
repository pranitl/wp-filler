// Browser configuration to avoid detection
const path = require('path');
const os = require('os');

// Get a persistent user data directory
const getUserDataDir = () => {
  const homeDir = os.homedir();
  return path.join(homeDir, '.wp-filler', 'browser-data');
};

// Browser configuration that mimics a real browser
const getBrowserConfig = () => {
  return {
    headless: process.env.HEADLESS === 'true',
    
    // Use a persistent browser context to maintain cookies/session
    // channel: 'chrome', // Commented out - using Chromium in Docker
    
    args: [
      '--disable-blink-features=AutomationControlled',  // Remove automation flags
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--start-maximized',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    
    // Slow down actions to appear more human
    slowMo: parseInt(process.env.SLOW_MO) || 100
  };
};

// Context configuration for stealth mode
const getContextConfig = () => {
  return {
    viewport: { width: 1920, height: 1080 },
    
    // Set user agent to match a real browser
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Accept language
    locale: 'en-US',
    
    // Timezone
    timezoneId: 'America/New_York',
    
    // Geolocation (optional, set to your area)
    geolocation: { latitude: 42.3601, longitude: -71.0589 },
    permissions: ['geolocation'],
    
    // Store cookies and local storage
    storageState: undefined, // Will be set if we have saved state
    
    // Additional HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    
    // Color scheme
    colorScheme: 'light',
    
    // Bypass CSP
    bypassCSP: true,
    
    // Java enabled
    javaScriptEnabled: true,
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true
  };
};

// Function to apply stealth mode to a context (must be called before creating pages)
const applyStealthMode = async (context) => {
  // Override the navigator.webdriver property
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });
  
  // Override navigator.plugins to appear more realistic
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: {
            type: "application/x-google-chrome-pdf",
            suffixes: "pdf",
            description: "Portable Document Format",
            enabledPlugin: Plugin
          },
          description: "Portable Document Format",
          filename: "internal-pdf-viewer",
          length: 1,
          name: "Chrome PDF Plugin"
        },
        {
          0: {
            type: "application/pdf",
            suffixes: "pdf",
            description: "",
            enabledPlugin: Plugin
          },
          description: "",
          filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
          length: 1,
          name: "Chrome PDF Viewer"
        }
      ]
    });
  });
  
  // Override permissions
  await context.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  // Add Chrome runtime
  await context.addInitScript(() => {
    window.chrome = {
      runtime: {
        connect: () => {},
        sendMessage: () => {},
        onMessage: { addListener: () => {} }
      }
    };
  });
  
  // Override navigator.hardwareConcurrency
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8
    });
  });
  
  // Override navigator.languages
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
  });
  
  // Set realistic viewport and screen dimensions
  await context.addInitScript(() => {
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  });
  
  // Add random mouse movements and delays (to be called with page)
  const addHumanBehavior = async (page) => {
    // Random mouse movement
    const viewport = page.viewportSize();
    const width = viewport?.width || 1920;
    const height = viewport?.height || 1080;
    
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      await page.mouse.move(x, y, { steps: 10 });
      await page.waitForTimeout(Math.random() * 200 + 100);
    }
  };
  
  return { addHumanBehavior };
};

// Save browser state (cookies, localStorage)
const saveState = async (context, stateFile = 'browser-state.json') => {
  const statePath = path.join(getUserDataDir(), stateFile);
  const state = await context.storageState();
  const fs = require('fs').promises;
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  return statePath;
};

// Load browser state
const loadState = async (stateFile = 'browser-state.json') => {
  const statePath = path.join(getUserDataDir(), stateFile);
  const fs = require('fs').promises;
  try {
    await fs.access(statePath);
    return statePath;
  } catch {
    return undefined;
  }
};

module.exports = {
  getBrowserConfig,
  getContextConfig,
  applyStealthMode,
  saveState,
  loadState,
  getUserDataDir
};