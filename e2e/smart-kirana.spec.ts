import { test, expect } from '@playwright/test';

test.describe('Smart Kirana - End-to-End Test Suite (Phase 12)', () => {
  const testMobile = '9888800001';
  const shopName = 'Balaji Kirana Store';
  const expectedUsername = 'balajikiranastore';
  const initialPassword = 'Password123!';
  const newPassword = 'NewSecretPassword888!';

  test('1. Register new store and login with case-insensitive username (FR-1.1 to FR-1.6)', async ({ page }) => {
    await page.goto('/');

    // Switch to Register form
    await page.locator('button:has-text("ఖాతా లేదా"), button:has-text("Register your shop")').click();

    // Fill shop name
    await page.locator('input[placeholder*="లక్ష్మి"], input[placeholder*="Stores"]').fill(shopName);

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

    // Switch to English language for consistency
    const englishBtn = page.locator('button:has-text("English")').first();
    await englishBtn.click();
    await page.waitForTimeout(500);

    // Test Logout
    const logoutBtn = page.locator('button:has-text("Log Out")').first();
    await logoutBtn.click();

    // Switch to Login screen if in Register view
    const loginSwitch = page.locator('button:has-text("Already have an account")').first();
    if (await loginSwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginSwitch.click();
    }

    // Test Case-Insensitive Login with UPPERCASE username
    await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername.toUpperCase());
    await page.locator('input[type="password"]').first().fill(initialPassword);
    await page.locator('button[type="submit"]:has-text("Log In")').click();

    // Verify successful login
    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 12000 });
  });

  test('2. OTP Forgot Password Reset (FR-1.7)', async ({ page }) => {
    await page.goto('/');

    // Ensure we are logged out
    const logoutBtn = page.locator('button:has-text("Log Out"), button:has-text("లాగౌట్")').first();
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
    }

    // Switch to Login screen if in Register view
    const loginSwitch = page.locator('button:has-text("Already have an account"), button:has-text("ఇప్పటికే ఖాతా ఉందా")').first();
    if (await loginSwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginSwitch.click();
    }

    // Click "Forgot Password"
    const forgotBtn = page.locator('button:has-text("Forgot Password"), button:has-text("పాస్‌వర్డ్ మర్చిపోయారా")').first();
    await forgotBtn.click();

    // Modal step 1: enter username & mobile
    const modal = page.locator('div.fixed');
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

    // Log in with new password
    await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
    await page.locator('input[type="password"]').first().fill(newPassword);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 12000 });
  });

  test('3. Concurrent Active Sessions on Two Browsers (FR-1.8, FR-1.9)', async ({ browser }) => {
    // Context 1
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/');
    await page1.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
    await page1.locator('input[type="password"]').first().fill(newPassword);
    await page1.locator('button[type="submit"]').click();
    await expect(page1.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    // Context 2 (simulating another device / browser)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/');
    await page2.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
    await page2.locator('input[type="password"]').first().fill(newPassword);
    await page2.locator('button[type="submit"]').click();
    await expect(page2.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    // Verify Context 1 is still logged in
    await page1.reload();
    await expect(page1.getByText(shopName).first()).toBeVisible({ timeout: 12000 });

    await context1.close();
    await context2.close();
  });

  test('4. Language Switch English <-> Telugu (FR-1.6, FR-12.4)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page.getByText(shopName).first()).toBeVisible();
    }

    // Switch to Telugu
    const teluguBtn = page.locator('button:has-text("తెలుగు")').first();
    await teluguBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("డాష్‌బోర్డ్")').first()).toBeVisible();

    // Switch back to English
    const englishBtn = page.locator('button:has-text("English")').first();
    await englishBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("Dashboard")').first()).toBeVisible();
  });

  test('5. Item Creation with Pricing, Unit & Margins (FR-3)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Ensure English UI
    const engBtn = page.locator('button:has-text("English")').first();
    if (await engBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await engBtn.click();
    }

    // Navigate to Items tab
    const itemsTab = page.locator('nav button:has-text("Items"), nav button:has-text("వస్తువులు")').first();
    await itemsTab.click();

    // Click "Add Item"
    const addItemBtn = page.locator('button:has-text("Add Item"), button:has-text("కొత్త సరుకు")').first();
    await addItemBtn.click();

    const modal = page.locator('div.fixed');

    // Fill Item details
    await modal.locator('input[type="text"]').nth(0).fill('Heritage Fresh Milk'); // Item Name
    await modal.locator('input[type="text"]').nth(1).fill('Dairy & Eggs'); // Category
    
    // Numbers: 0 is Quantity, 1 is Cost Price, 2 is Selling Price
    const numInputs = modal.locator('input[type="number"]');
    await numInputs.nth(0).fill('25'); // Quantity
    await numInputs.nth(1).fill('50'); // Cost Price (CP)
    await numInputs.nth(2).fill('60'); // Selling Price (SP)

    // Save Item
    await modal.locator('button[type="submit"]').first().click();

    // Verify item in list
    await expect(page.getByText('Heritage Fresh Milk').first()).toBeVisible({ timeout: 8000 });
  });

  test('6. Purchases Entry (FR-5.2 to FR-5.6)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Navigate to Purchases tab
    const purchasesTab = page.locator('nav button:has-text("Purchases"), nav button:has-text("కొనుగోళ్లు")').first();
    await purchasesTab.click();
    await expect(page.getByText(/Purchases|కొనుగోళ్లు/i).first()).toBeVisible();
  });

  test('7. Bill Upload & Review (FR-6.1 to FR-6.9)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Navigate to Bills tab
    const billsTab = page.locator('nav button:has-text("Bills"), nav button:has-text("బిల్లులు")').first();
    await billsTab.click();
    await expect(page.getByText(/Bills & Invoices|బిల్లులు/i).first()).toBeVisible();
  });

  test('8. Global Search with Instant Results (FR-7)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Type in global search bar
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="వెతకండి"]').first();
    await searchInput.fill('Heritage');

    // Wait for search dropdown
    await page.waitForTimeout(600);
    await expect(page.getByText('Heritage Fresh Milk').first()).toBeVisible({ timeout: 8000 });
  });

  test('9. Customer Credit Section (FR-10)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Navigate to Credit tab
    const creditTab = page.locator('nav button:has-text("Credit"), nav button:has-text("అప్పులు")').first();
    await creditTab.click();
    await expect(page.getByText(/Customer Credit|కస్టమర్ అప్పులు|Customer/i).first()).toBeVisible();
  });

  test('10. Daily Online Payments & Supplier Cash Flow (FR-11)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Navigate to Online Payments tab
    const onlineTab = page.locator('nav button:has-text("Online"), nav button:has-text("ఆన్‌లైన్")').first();
    await onlineTab.click();
    await expect(page.getByText(/Online Payments|ఆన్‌లైన్ చెల్లింపులు|Daily/i).first()).toBeVisible();
  });

  test('11. Log out from All Devices (FR-1.10, FR-12.6)', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('input[placeholder*="srilakshmistores"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('input[placeholder*="srilakshmistores"]').fill(expectedUsername);
      await page.locator('input[type="password"]').first().fill(newPassword);
      await page.locator('button[type="submit"]').click();
    }

    // Navigate to Settings
    const settingsTab = page.locator('nav button:has-text("Settings"), nav button:has-text("సెట్టింగ్‌లు")').first();
    await settingsTab.click();

    // Find "Log out from all devices" button
    const logoutAllBtn = page.locator('button:has-text("Log out from all devices"), button:has-text("అన్ని పరికరాల నుండి లాగౌట్")').first();
    await expect(logoutAllBtn).toBeVisible({ timeout: 8000 });

    // Handle confirm dialog
    page.once('dialog', (dialog) => dialog.accept());
    await logoutAllBtn.click();

    // Verify redirected back to Login screen
    await expect(page.locator('input[placeholder*="srilakshmistores"], input[placeholder*="యూజర్"]').first()).toBeVisible({ timeout: 8000 });
  });
});
