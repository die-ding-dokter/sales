import { test, expect } from '@playwright/test';
test('single tenant sign-in is closed until configured; sample is isolated', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeDisabled();
  await page.getByRole('button', { name: 'Open sample workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Let’s move business forward.' })).toBeVisible();
  await expect(page.locator('.demo-banner')).toContainText('Fictional data');
  await page.getByRole('button', { name: 'Integrations', exact: true }).click();
  await page.getByRole('button', { name: 'View my calendar' }).click();
  await expect(page.locator('#notice')).toContainText('unavailable in the sample');
});
test('create, approve, accept and record finance with server-equivalent domain rules', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open sample workspace' }).click();
  await page.getByRole('button', { name: 'New opportunity' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Opportunity name').fill('Office repair'); await d.getByLabel('Customer', { exact: true }).fill('Fictional Company');
  await d.getByLabel('Quoted item or service').fill('Repair'); await d.getByLabel('Unit selling price').fill('1500'); await d.getByLabel('Unit direct cost').fill('700');
  await d.getByLabel('Next action', { exact: true }).fill('Confirm parts'); await d.getByRole('button', { name: 'Save opportunity' }).click();
  await page.getByRole('button', { name: 'Sales pipeline', exact: true }).click();
  await page.getByRole('button', { name: 'Office repair', exact: true }).click();
  await page.getByRole('button', { name: 'Submit for approval' }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Office repair', exact: true }).click();
  await page.getByRole('button', { name: 'Approve quotation' }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Office repair', exact: true }).click();
  await page.getByRole('button', { name: 'Record acceptance' }).click(); await page.getByLabel('Evidence reference').fill('PO-SAMPLE-42'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Office repair', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit scope' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record accounting invoice' }).click(); await page.getByLabel('Accounting invoice reference').fill('SAMPLE-INV-42'); await page.getByRole('button', { name: 'Save accounting reference' }).click();
  await page.getByRole('button', { name: 'Office repair', exact: true }).click();
  await page.getByRole('button', { name: 'Record net receipt' }).click(); await page.getByLabel('Net amount').fill('500'); await page.getByLabel('Receipt reference').fill('SAMPLE-BANK-42'); await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByRole('button', { name: 'Invoice register', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'SAMPLE-INV-42', exact: true })).toBeVisible();
  const invoiceRow = page.getByRole('row').filter({ hasText: 'SAMPLE-INV-42' });
  await expect(invoiceRow).toContainText(/500[.,]00/);
});
for (const width of [320, 768, 1440]) test(`layout and navigation at ${width}px in both themes`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.screenshot({ path: `test-results/login-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Open sample workspace' }).click();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    await page.screenshot({ path: `test-results/precheck-${width}-${theme}.png`, fullPage: true });
    const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, items: [...document.querySelectorAll('*')].filter(e => !e.closest('.table-scroll') && e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right })).slice(0, 10) }));
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
    await page.screenshot({ path: `test-results/overview-${width}-${theme}.png`, fullPage: true });
  }
  if (width < 900) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Team performance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress people can trust.' })).toBeVisible();
  if (width === 1440) {
    for (const name of ['Sales pipeline', 'Quotations', 'Invoice register', 'Integrations', 'Settings']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.screenshot({ path: `test-results/${name.replaceAll(' ', '-')}.png`, fullPage: true });
    }
  }
});
