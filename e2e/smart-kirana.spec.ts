import { test, expect } from '@playwright/test';

test.describe('Smart Kirana - End-to-End Test Suite (Phase 12)', () => {
  test.describe.configure({ mode: 'serial' });

  const runId = Math.floor(1000 + Math.random() * 9000);
  const testMobile = '98' + Math.floor(10000000 + Math.random() * 90000000); // 10 digits
  const shopName = `Balaji Store ${runId}`;
  const expectedUsername = `balajistore${runId}`;
  const initialPassword = 'Password123!';
  const newPassword = 'NewSecretPassword888!';

  async function ensureLoggedIn(page: any) {
    await page.goto('/');
    await page.waitForTimeout(500);

    const loginSwitch = page.locator('button:has-text("Already have an account"), button:has-text("ఇప్పటికే ఖాతా ఉందా")').first();
    if (await loginSwitch.isVisible().catch(() => false)) {
      await loginSwitch.click();
      await page.waitForTimeout(300);
    }

    const userField = page.locator('input[placeholder*="srilakshmistores"]');
    if (await userField.isVisible().catch(() => false)) {
      await userField.fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('form button:has-text("Log In"), form button:has-text("లాగిన్")').first().click();
      await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 12000 });
    } else {
      await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 8000 });
    }
  }

  async function ensureEnglish(page: any) {
    const engBtn = page.locator('button:has-text("English")').first();
    if (await engBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await engBtn.click();
      await page.waitForTimeout(300);
    }
  }

  test('1. Register new store and login with case-insensitive username (FR-1.1 to FR-1.6)', async ({ page }) => {
    await page.goto('/');

    // Switch to Register form if on Login
    const regSwitch = page.locator('button:has-text("ఖాతా లేదా"), button:has-text("Register your shop"), button:has-text("No account yet")').first();
    if (await regSwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await regSwitch.click();
    }

    // Fill shop name
    await page.locator('input[placeholder*="లక్ష్మి"], input[placeholder*="Stores"]').fill(shopName);
    await page.waitForTimeout(500);

    // Fill 10-digit mobile number
    await page.locator('input[type="tel"]').fill(testMobile);

    // Click "Send OTP"
    await page.locator('button:has-text("ఓటీపీ"), button:has-text("OTP")').first().click();

    // Click demo Auto-fill button for dev OTP code
    const autoFillBtn = page.locator('button:has-text("Auto-fill")').first();
    await expect(autoFillBtn).toBeVisible({ timeout: 8000 });
    await autoFillBtn.click();

    // Fill password and confirm password
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill(initialPassword);
    await pwInputs.nth(1).fill(initialPassword);

    // Submit registration form
    await page.locator('button[type="submit"]:has-text("నమోదు"), button[type="submit"]:has-text("Register")').click();

    // Verify logged in and dashboard displayed
    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    // Switch to English language
    await ensureEnglish(page);

    // Test Logout
    const logoutBtn = page.locator('button[title*="Log Out"], button[title*="లాగౌట్"], button:has-text("Log Out"), button:has-text("లాగౌట్")').first();
    await logoutBtn.click();

    // After logging out, ensure we switch to Login form if Register form is shown
    const loginSwitch = page.locator('button:has-text("Already have an account"), button:has-text("ఇప్పటికే ఖాతా ఉందా")').first();
    await expect(loginSwitch).toBeVisible({ timeout: 10000 });
    await loginSwitch.click();

    // Test Case-Insensitive Login with UPPERCASE username (FR-1.3)
    const usernameInput = page.locator('input[placeholder*="srilakshmistores"]');
    await expect(usernameInput).toBeVisible({ timeout: 8000 });
    await usernameInput.fill(expectedUsername.toUpperCase());
    await page.locator('input[type="password"]').first().fill(initialPassword);
    await page.locator('form button:has-text("Log In"), form button:has-text("లాగిన్")').first().click();

    // Verify successful login
    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 12000 });
  });

  test('2. OTP Forgot Password Reset (FR-1.7)', async ({ page }) => {
    await page.goto('/');

    // If currently logged in, log out
    const logoutBtn = page.locator('button[title*="Log Out"], button[title*="లాగౌట్"], button:has-text("Log Out"), button:has-text("లాగౌట్")').first();
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
    }

    // Ensure we are on the Login screen
    const loginSwitch = page.locator('button:has-text("Already have an account"), button:has-text("ఇప్పటికే ఖాతా ఉందా")').first();
    if (await loginSwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginSwitch.click();
    }

    // Click "Forgot Password"
    const forgotBtn = page.locator('button:has-text("Forgot Password"), button:has-text("పాస్‌వర్డ్ మర్చిపోయారా")').first();
    await expect(forgotBtn).toBeVisible({ timeout: 8000 });
    await forgotBtn.click();

    // Modal step 1: enter username & mobile
    const modal = page.locator('div.fixed');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
    await modal.locator('input[type="tel"]').fill(testMobile);
    await modal.locator('button[type="submit"]').click();

    // Step 2: Read dev OTP code from modal and enter new password & confirm password
    const devOtpSpan = modal.locator('span.font-mono');
    await expect(devOtpSpan).toBeVisible({ timeout: 8000 });
    const otpCode = (await devOtpSpan.textContent())?.trim() || '123456';

    await modal.locator('input[placeholder*="6-digit"]').fill(otpCode);

    const modalPwInputs = modal.locator('input[type="password"]');
    await modalPwInputs.nth(0).fill(newPassword);
    await modalPwInputs.nth(1).fill(newPassword);

    // Submit password reset
    await modal.locator('button[type="submit"]').click();

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 8000 });

    // Log in with new password
    const loginUserInput = page.locator('input[placeholder*="srilakshmistores"]');
    await expect(loginUserInput).toBeVisible({ timeout: 8000 });
    await loginUserInput.fill(expectedUsername);
    await page.locator('input[type="password"]').first().fill(newPassword);
    await page.locator('form button:has-text("Log In"), form button:has-text("లాగిన్")').first().click();

    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 12000 });
  });

  test('3. Concurrent Active Sessions on Two Browsers (FR-1.8, FR-1.9)', async ({ browser }) => {
    // Context 1
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/');
    const loginSwitch1 = page1.locator('button:has-text("Already have an account"), button:has-text("ఇప్పటికే ఖాతా ఉందా")').first();
    if (await loginSwitch1.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginSwitch1.click();
    }
    const user1 = page1.locator('input[placeholder*="srilakshmistores"]');
    await expect(user1).toBeVisible({ timeout: 8000 });
    await user1.fill(expectedUsername);
    await page1.locator('input[type="password"]').first().fill(newPassword);
    await page1.locator('form button:has-text("Log In"), form button:has-text("లాగిన్")').first().click();
    await expect(page1.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    // Context 2 (simulating another device / browser)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/');
    const loginSwitch2 = page2.locator('button:has-text("Already have an account"), button:has-text("ఇప్పటికే ఖాతా ఉందా")').first();
    if (await loginSwitch2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginSwitch2.click();
    }
    const user2 = page2.locator('input[placeholder*="srilakshmistores"]');
    await expect(user2).toBeVisible({ timeout: 8000 });
    await user2.fill(expectedUsername);
    await page2.locator('input[type="password"]').first().fill(newPassword);
    await page2.locator('form button:has-text("Log In"), form button:has-text("లాగిన్")').first().click();
    await expect(page2.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    // Verify Context 1 is still logged in after Context 2 logged in
    await page1.reload();
    await expect(page1.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    await context1.close();
    await context2.close();
  });

  test('4. Language Switch English <-> Telugu (FR-1.6, FR-12.4)', async ({ page }) => {
    await ensureLoggedIn(page);

    // Switch to Telugu
    const teluguBtn = page.locator('button:has-text("తెలుగు")').first();
    await teluguBtn.click();
    await page.waitForTimeout(400);
    await expect(page.locator('button:has-text("డాష్‌బోర్డ్")').first()).toBeVisible();

    // Switch back to English
    const englishBtn = page.locator('button:has-text("English")').first();
    await englishBtn.click();
    await page.waitForTimeout(400);
    await expect(page.locator('button:has-text("Dashboard")').first()).toBeVisible();
  });

  test('5. Item Creation with Pricing, Unit & Margins (FR-3)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Navigate to Items tab
    const itemsTab = page.locator('nav button:has-text("Items"), nav button:has-text("వస్తువులు")').first();
    await itemsTab.click();

    // Click "Add Item"
    const addItemBtn = page.locator('button:has-text("Add New Item"), button:has-text("Add Item"), button:has-text("కొత్త సరుకు")').first();
    await addItemBtn.click();

    const modal = page.locator('div.fixed');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill Item details: name, category, quantity, costPrice, sellingPrice
    const textInputs = modal.locator('input[type="text"]');
    await textInputs.nth(0).fill('Heritage Fresh Milk');
    await textInputs.nth(1).fill('Dairy & Eggs');
    
    // Numbers: 0 is Quantity, 1 is Cost Price, 2 is Selling Price
    const numInputs = modal.locator('input[type="number"]');
    await numInputs.nth(0).fill('25'); // Quantity
    await numInputs.nth(1).fill('50'); // Cost Price (CP)
    await numInputs.nth(2).fill('60'); // Selling Price (SP)

    // Save Item
    await modal.locator('button[type="submit"]').first().click();
    await expect(modal).not.toBeVisible({ timeout: 8000 });

    // Verify item in list
    await expect(page.getByText('Heritage Fresh Milk').first()).toBeVisible({ timeout: 8000 });
  });

  test('6. Purchases Entry (FR-5.2 to FR-5.6)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Navigate to Purchases tab
    const purchasesTab = page.locator('nav button:has-text("Purchases"), nav button:has-text("కొనుగోళ్లు")').first();
    await purchasesTab.click();
    await expect(page.getByText(/Purchases|కొనుగోళ్లు/i).first()).toBeVisible();

    // Click "New Purchase Entry"
    const newPurchaseBtn = page.locator('button:has-text("New Purchase"), button:has-text("కొత్త కొనుగోలు")').first();
    await newPurchaseBtn.click();
    const modal = page.locator('div.fixed');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Supplier
    await modal.locator('input[placeholder*="Venkateshwara"]').fill('Local Dairy Farm');
    // Line item name
    await modal.locator('input[placeholder*="Item name"], input[placeholder*="సరుకు పేరు"]').first().fill('Heritage Fresh Milk');

    // Click Record Purchase
    await modal.locator('button[type="submit"]:has-text("Record"), button[type="submit"]:has-text("కొనుగోలు")').first().click();
    await expect(modal).not.toBeVisible({ timeout: 8000 });

    // Verify purchase appears in the list
    await expect(page.getByText('Local Dairy Farm').first()).toBeVisible({ timeout: 8000 });
  });

  test('7. Bill Upload & Review (FR-6.1 to FR-6.9)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Navigate to Bills tab
    const billsTab = page.locator('nav button:has-text("Bills"), nav button:has-text("బిల్లులు")').first();
    await billsTab.click();
    await expect(page.getByText(/Bills & Invoices|బిల్లులు/i).first()).toBeVisible();

    // Click "Upload Bill"
    const uploadBtn = page.locator('button:has-text("Upload Bill"), button:has-text("బిల్లును అప్‌లోడ్")').first();
    await uploadBtn.click();

    const modal = page.locator('div.fixed');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Upload a test 1x1 image buffer
    await modal.locator('input[type="file"]').first().setInputFiles({
      name: 'invoice-sample.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    // Fill supplier & bill number
    await modal.locator('input[placeholder*="Venkateshwara"]').fill('Local Dairy Farm');
    await modal.locator('input[placeholder*="INV-"]').fill('INV-2026-001');

    // Submit bill upload
    await modal.locator('button[type="submit"]:has-text("Upload Bill"), button[type="submit"]:has-text("అప్‌లోడ్")').first().click();

    // Bill Review screen automatically opens (FR-6.5)
    const reviewHeading = page.locator('h3:has-text("Bill Review"), h3:has-text("సమీక్ష")');
    await expect(reviewHeading.first()).toBeVisible({ timeout: 12000 });

    // Close review modal
    const cancelOrCloseBtn = page.locator('div.fixed button:has-text("Cancel"), div.fixed button:has-text("రద్దు")').first();
    await cancelOrCloseBtn.click();

    // Verify bill appears in the list
    await expect(page.getByText('INV-2026-001').first()).toBeVisible({ timeout: 8000 });
  });

  test('8. Global Search with Instant Results (FR-7)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Type in global search bar
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="వెతకండి"]').first();
    await searchInput.fill('Heritage');

    // Wait for search dropdown
    await page.waitForTimeout(600);
    await expect(page.getByText('Heritage Fresh Milk').first()).toBeVisible({ timeout: 8000 });
  });

  test('9. Customer Credit Section (FR-10)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Navigate to Credit tab
    const creditTab = page.locator('nav button:has-text("Credit"), nav button:has-text("అప్పులు")').first();
    await creditTab.click();
    await expect(page.getByText(/Customer Credit|కస్టమర్ అప్పులు|Customer/i).first()).toBeVisible();

    // Click "Add Customer"
    const addCustBtn = page.locator('button:has-text("Add Customer"), button:has-text("కొత్త ఖాతాదారు")').first();
    await addCustBtn.click();
    const modal = page.locator('div.fixed');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill customer name
    await modal.locator('input[placeholder*="Ramesh"], input[placeholder*="పేరు"]').fill('Kavya Suma');
    await modal.locator('input[type="tel"]').fill('9988776655');
    await modal.locator('button[type="submit"]').first().click();

    // Verify customer is shown or listed
    await expect(page.getByText('Kavya Suma').first()).toBeVisible({ timeout: 8000 });
  });

  test('10. Daily Online Payments & Supplier Cash Flow (FR-11)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Navigate to Online Payments tab
    const onlineTab = page.locator('nav button:has-text("Online"), nav button:has-text("ఆన్‌లైన్")').first();
    await onlineTab.click();
    await expect(page.getByText(/Online Payments|ఆన్‌లైన్ చెల్లింపులు|Daily/i).first()).toBeVisible();

    // Enter daily online total (e.g. ₹1500)
    const dailyInput = page.locator('input[placeholder*="5000"]').first();
    await dailyInput.fill('1500');
    const saveDailyBtn = page.locator('button:has-text("Save Daily Entry"), button:has-text("సేవ్")').first();
    await saveDailyBtn.click();

    // Verify confirmation feedback or value reflected
    await expect(page.getByText(/1,500|1500/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('11. Log out from All Devices (FR-1.10, FR-12.6)', async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureEnglish(page);

    // Navigate to Settings
    const settingsTab = page.locator('nav button:has-text("Settings"), nav button:has-text("సెట్టింగ్‌లు")').first();
    await settingsTab.click();

    // Find "Log out from all devices" button
    const logoutAllBtn = page.locator('button:has-text("Log out from all devices"), button:has-text("అన్ని పరికరాల నుండి లాగౌట్")').first();
    await expect(logoutAllBtn).toBeVisible({ timeout: 8000 });
    await logoutAllBtn.click();

    // Confirmation Modal: Click Confirm
    const modal = page.locator('div.fixed');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('button:has-text("Confirm"), button:has-text("ఖాయం"), button:has-text("నిర్ధారించండి")').first().click();

    // Verify redirected back to Login screen
    await expect(page.locator('input[placeholder*="srilakshmistores"], input[placeholder*="యూజర్"]').first()).toBeVisible({ timeout: 8000 });
  });
});
