#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { auditNavigation, auditPage } from './browser.mjs';
import { BUDGETS, parseOptions, renderMarkdown, summarize } from './report.mjs';

const help = `Usage: npm run performance:audit -- [options]
  --origin ORIGIN     PERFORMANCE_ORIGIN       https://divine.video
  --output DIRECTORY  PERFORMANCE_OUTPUT       performance-results
  --samples N         PERFORMANCE_SAMPLES      3 (1–10 per route/device)
  --timeout-ms N      PERFORMANCE_TIMEOUT_MS   30000 (500–60000)
  --observe-ms N      PERFORMANCE_OBSERVE_MS   5000 (100–15000 after readiness)
  --search TEXT       PERFORMANCE_SEARCH       funny (omitted from reports)
  --strict            PERFORMANCE_STRICT=true  fail budget exceedances
  --throttle          PERFORMANCE_THROTTLE=true mobile network/CPU preset
  --help                                      show this help
Missing primary content, LCP, discovery links, navigation HTTP errors or
non-advancing video detail playback fail in all modes. Background request
failures are reported separately. Thresholds are otherwise advisory.
Outputs: report.json and report.md. Exit 0 pass, 1 audit failure, 2 setup error.
`;

async function run(options) {
  const browser = await chromium.launch();
  const samples = [];
  const profiles = [
    { name: 'desktop', context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'mobile', context: { ...devices['Pixel 7'] } },
  ];
  try {
    for (const device of profiles) {
      let discovered = { video: null, profile: null };
      for (const path of ['/discovery', '/', '/popular', `/search?q=${encodeURIComponent(options.search)}`]) {
        for (let sample = 1; sample <= options.samples; sample++) {
          const result = await auditPage(browser, options, device, path, sample);
          samples.push(result.row);
          if (result.links) {
            discovered.video ??= result.links.video;
            discovered.profile ??= result.links.profile;
          }
          process.stdout.write(`${device.name} ${result.row.route} ${sample}/${options.samples}: ${result.row.failures.join(', ') || 'ready'}\n`);
        }
      }
      for (const type of ['video', 'profile']) {
        for (let sample = 1; sample <= options.samples; sample++) {
          if (!discovered[type]) {
            samples.push({ route: type === 'video' ? '/video/:id' : '/u/:name', device: device.name, sample, mode: 'cold',
              failures: ['discovery-link-missing'], outcome: 'not-measured' });
          } else {
            const result = await auditPage(browser, options, device, discovered[type], sample);
            samples.push(result.row);
            process.stdout.write(`${device.name} ${result.row.route} ${sample}/${options.samples}: ${result.row.failures.join(', ') || 'ready'}\n`);
          }
        }
      }
    }
    for (const device of profiles) {
      const row = await auditNavigation(browser, options, device);
      samples.push(row);
      process.stdout.write(`${device.name} soft-navigation /video/:id: ${row.failures.join(', ') || 'ready'}\n`);
    }
    const summary = summarize(samples);
    const failed = samples.some(row => row.failures.length) || (options.strict && summary.some(row =>
      Object.entries(BUDGETS).some(([metric, budget]) => row.metrics[metric].p75 > budget)));
    const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), origin: options.origin,
      browserVersion: browser.version(), strict: options.strict, budgets: BUDGETS,
      configuration: { samples: options.samples, timeoutMs: options.timeoutMs, observeMs: options.observeMs, throttle: options.throttle },
      passed: !failed, summary, samples };
    await mkdir(resolve(options.output), { recursive: true });
    await writeFile(resolve(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(resolve(options.output, 'report.md'), renderMarkdown(report));
    for (const row of summary.filter(row => row.warnings.length)) {
      process.stdout.write(`Warning: ${row.device} ${row.route}: ${row.warnings.join(', ')}\n`);
    }
    process.exitCode = failed ? 1 : 0;
  } finally { await browser.close(); }
}

if (process.argv.includes('--help')) process.stdout.write(help);
else {
  try { await run(parseOptions(process.argv.slice(2))); }
  catch { process.stderr.write('Performance audit setup failed. Check options, browser installation, and output directory. No raw error data retained.\n'); process.exitCode = 2; }
}
