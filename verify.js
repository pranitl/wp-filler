const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the verification URL
  console.log('Navigating to verification URL...');
  await page.goto('https://mandrillapp.com/track/click/31136223/www.firstlighthomecare.com?p=eyJzIjoiQUlRRjg2NlFfU2dQdTJDLUl1WVBzQ0RMU2UwIiwidiI6MiwicCI6IntcInVcIjozMTEzNjIyMyxcInZcIjoyLFwidXJsXCI6XCJodHRwczpcXFwvXFxcL3d3dy5maXJzdGxpZ2h0aG9tZWNhcmUuY29tXFxcL2hvbWUtaGVhbHRoY2FyZS1ib3N0b24tbm9ydGh3ZXN0XFxcL3dwLWxvZ2luLnBocD93ZmxzLWVtYWlsLXZlcmlmaWNhdGlvbj10bE1qa2VlQUozMnl6N2g0TUxZcW9HQTI5N1VaT28zVmxHRU40eTlrWCUyRlFGQk1PbUc0UGFySUw0VXZuUyUyQlZDV3JNcWtWTExGbVJXZzh6bmZVeE9IVEElM0QlM0RcIixcImlkXCI6XCIxYTIyZTU0ODdkYjI0Mzc3YTRmMWVkMzAzNmU0ZGJiZFwiLFwidXJsX2lkc1wiOltcIjZjNDczZTNmMmYwNmVkYWNjN2FmMDA3YjAzOGI4NWE4OThlMjdhZDNcIl0sXCJtc2dfdHNcIjoxNzU2MTc0NzE1fSJ9');
  
  // Wait for redirects
  await page.waitForTimeout(5000);
  
  console.log('Current URL:', page.url());
  
  // If on login page, login
  const loginField = await page.$('#user_login');
  if (loginField) {
    console.log('On login page, logging in...');
    await page.fill('#user_login', 'glahoty');
    await page.fill('#user_pass', 'Daftar@2030');
    await page.click('#wp-submit');
    await page.waitForTimeout(5000);
  }
  
  // Save the session
  const storageState = await context.storageState();
  const fs = require('fs').promises;
  await fs.mkdir('.wp-session', { recursive: true });
  await fs.writeFile('.wp-session/session.json', JSON.stringify(storageState, null, 2));
  
  console.log('Session saved! The wp-filler will now use this verified session.');
  
  await browser.close();
})();