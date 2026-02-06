// Accessibility audit script using Playwright + axe-core
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const url = process.argv[2] || 'http://localhost:8083/discovery';
const theme = process.argv[3] || 'both'; // 'light', 'dark', or 'both'

async function runAudit(page, mode) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Running ${mode.toUpperCase()} MODE audit on: ${page.url()}`);
  console.log('='.repeat(50));

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  console.log('\n--- VIOLATIONS ---');
  if (results.violations.length === 0) {
    console.log('✅ No violations found!');
  } else {
    for (const v of results.violations) {
      const impact = v.impact ? v.impact.toUpperCase() : 'UNKNOWN';
      console.log(`\n❌ [${impact}] ${v.id}: ${v.description}`);
      console.log(`   Help: ${v.helpUrl}`);
      console.log(`   Affected: ${v.nodes.length} element(s)`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`     - ${node.target.join(' > ')}`);
      }
      if (v.nodes.length > 3) {
        console.log(`     ... and ${v.nodes.length - 3} more`);
      }
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Violations: ${results.violations.length}`);
  console.log(`Passes: ${results.passes.length}`);
  console.log(`Incomplete: ${results.incomplete.length}`);

  return results.violations.length;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    bypassCSP: true,
    // Force no caching
    extraHTTPHeaders: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
  const page = await context.newPage();

  await page.goto(url);
  await page.waitForLoadState('networkidle');

  let totalViolations = 0;

  if (theme === 'light' || theme === 'both') {
    // Ensure we're in light mode
    // "Dark mode" button means we're currently in light mode
    // "Light mode" button means we're currently in dark mode (click to go to light)
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      await page.locator('button:has-text("Light mode")').click();
      await page.waitForTimeout(500);
      await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
    }
    totalViolations += await runAudit(page, 'light');
  }

  if (theme === 'dark' || theme === 'both') {
    // Ensure we're in dark mode
    // "Dark mode" button means we're currently in light mode (click to go to dark)
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) {
      await page.locator('button:has-text("Dark mode")').click();
      await page.waitForTimeout(500);
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    }
    totalViolations += await runAudit(page, 'dark');
  }

  await browser.close();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL VIOLATIONS: ${totalViolations}`);
  console.log('='.repeat(50));

  process.exit(totalViolations > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
