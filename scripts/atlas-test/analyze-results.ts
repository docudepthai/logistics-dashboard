/**
 * Analyze Atlas Test Results and Generate Report
 * Reads results.jsonl and custom-results.jsonl to produce comprehensive analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const RESULTS_FILE = path.join(__dirname, '../../test-data/results.jsonl');
const CUSTOM_RESULTS_FILE = path.join(__dirname, '../../test-data/custom-results.jsonl');
const REPORT_FILE = path.join(__dirname, '../../test-data/report.md');

interface TestResult {
  conversationId: string;
  messageIndex: number;
  userMessage: string;
  previousAssistantResponse?: string;

  atlasIntent: string;
  atlasResponse: string;
  atlasJobCount: number;
  atlasLatencyMs: number;
  atlasError?: string;

  parsedOrigin?: string;
  parsedDestination?: string;

  hasLocationInMessage: boolean;
  hasCityName: boolean;
  isSearchLike: boolean;
}

interface CustomTestResult {
  testCase: {
    id: number;
    category: string;
    input: string;
    expectedIntent: string | string[];
    expectedOrigin?: string;
    expectedDestination?: string;
    notes?: string;
  };
  actualIntent: string;
  actualResponse: string;
  actualOrigin?: string;
  actualDestination?: string;
  actualJobCount: number;
  latencyMs: number;
  error?: string;
  intentCorrect: boolean;
  locationCorrect: boolean;
  passed: boolean;
}

interface EdgeCase {
  category: string;
  message: string;
  intent: string;
  response: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const results: T[] = [];

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return results;
  }

  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        results.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed lines
      }
    }
  }

  return results;
}

function categorizeEdgeCases(results: TestResult[]): EdgeCase[] {
  const edgeCases: EdgeCase[] = [];

  for (const r of results) {
    // Category 1: Location in message but not parsed
    if (r.hasCityName && !r.parsedOrigin && !r.parsedDestination && r.atlasIntent !== 'error') {
      edgeCases.push({
        category: 'location_not_parsed',
        message: r.userMessage,
        intent: r.atlasIntent,
        response: r.atlasResponse.substring(0, 100),
        issue: 'City name detected in message but no location was parsed',
        severity: 'high',
      });
    }

    // Category 2: Search-like message but non-search intent
    if (r.isSearchLike && !['search', 'intra_city', 'pagination'].includes(r.atlasIntent) && r.atlasIntent !== 'error') {
      edgeCases.push({
        category: 'search_misclassified',
        message: r.userMessage,
        intent: r.atlasIntent,
        response: r.atlasResponse.substring(0, 100),
        issue: `Search-like message classified as ${r.atlasIntent}`,
        severity: 'medium',
      });
    }

    // Category 3: Errors
    if (r.atlasError) {
      edgeCases.push({
        category: 'error',
        message: r.userMessage,
        intent: r.atlasIntent,
        response: r.atlasError,
        issue: `Error during processing: ${r.atlasError}`,
        severity: 'high',
      });
    }

    // Category 4: Very slow responses (>5s)
    if (r.atlasLatencyMs > 5000) {
      edgeCases.push({
        category: 'slow_response',
        message: r.userMessage,
        intent: r.atlasIntent,
        response: r.atlasResponse.substring(0, 50),
        issue: `Slow response: ${r.atlasLatencyMs}ms`,
        severity: 'low',
      });
    }

    // Category 5: Search intent but no results and no nearby suggestion
    if (r.atlasIntent === 'search' && r.atlasJobCount === 0) {
      if (!r.atlasResponse.includes('civar') && !r.atlasResponse.includes('komsu')) {
        edgeCases.push({
          category: 'no_results_no_suggestion',
          message: r.userMessage,
          intent: r.atlasIntent,
          response: r.atlasResponse.substring(0, 100),
          issue: 'No results found but no nearby search suggested',
          severity: 'low',
        });
      }
    }

    // Category 6: Turkish suffix confusion (destination parsed as origin or vice versa)
    const msg = r.userMessage.toLowerCase();
    if ((msg.includes('dan') || msg.includes('den')) && (msg.includes('ya') || msg.includes('ye') || msg.includes(' a ') || msg.includes(' e '))) {
      // Message has both origin and dest suffixes
      if (r.parsedOrigin && !r.parsedDestination) {
        edgeCases.push({
          category: 'suffix_confusion',
          message: r.userMessage,
          intent: r.atlasIntent,
          response: `origin=${r.parsedOrigin}, dest=${r.parsedDestination}`,
          issue: 'Message has both suffixes but only origin was parsed',
          severity: 'high',
        });
      }
    }
  }

  return edgeCases;
}

function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * (p / 100));
  return sorted[idx] || 0;
}

async function generateReport(): Promise<void> {
  console.log('=== Atlas Agent Test Analysis ===\n');

  // Read production results
  console.log('Reading production test results...');
  const prodResults = await readJsonl<TestResult>(RESULTS_FILE);
  console.log(`  Found ${prodResults.length} production test results`);

  // Read custom results
  console.log('Reading custom test results...');
  const customResults = await readJsonl<CustomTestResult>(CUSTOM_RESULTS_FILE);
  console.log(`  Found ${customResults.length} custom test results`);

  // === PRODUCTION METRICS ===
  const totalProd = prodResults.length;
  const errorsProd = prodResults.filter(r => r.atlasError).length;
  const searchesProd = prodResults.filter(r => r.atlasIntent === 'search');
  const searchesWithResults = searchesProd.filter(r => r.atlasJobCount > 0).length;

  // Intent distribution
  const intentCounts: Record<string, number> = {};
  for (const r of prodResults) {
    intentCounts[r.atlasIntent] = (intentCounts[r.atlasIntent] || 0) + 1;
  }

  // Latency stats
  const latencies = prodResults.map(r => r.atlasLatencyMs);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50Latency = percentile(latencies, 50);
  const p95Latency = percentile(latencies, 95);
  const p99Latency = percentile(latencies, 99);

  // Location parsing
  const withLocation = prodResults.filter(r => r.hasCityName);
  const locationParsed = withLocation.filter(r => r.parsedOrigin || r.parsedDestination);
  const locationParseRate = (locationParsed.length / withLocation.length) * 100;

  // Edge case detection
  const edgeCases = categorizeEdgeCases(prodResults);
  const edgeCasesByCategory: Record<string, EdgeCase[]> = {};
  for (const ec of edgeCases) {
    if (!edgeCasesByCategory[ec.category]) {
      edgeCasesByCategory[ec.category] = [];
    }
    edgeCasesByCategory[ec.category].push(ec);
  }

  // === CUSTOM TEST METRICS ===
  const customPassed = customResults.filter(r => r.passed).length;
  const customIntentCorrect = customResults.filter(r => r.intentCorrect).length;
  const customLocationCorrect = customResults.filter(r => r.locationCorrect).length;

  // Custom by category
  const customByCategory: Record<string, { passed: number; total: number }> = {};
  for (const r of customResults) {
    const cat = r.testCase.category;
    if (!customByCategory[cat]) {
      customByCategory[cat] = { passed: 0, total: 0 };
    }
    customByCategory[cat].total++;
    if (r.passed) customByCategory[cat].passed++;
  }

  // === GENERATE REPORT ===
  let report = `# Atlas Agent Test Report

Generated: ${new Date().toISOString()}

## Executive Summary

| Metric | Value |
|--------|-------|
| Production Messages Tested | ${totalProd.toLocaleString()} |
| Custom Tests Run | ${customResults.length} |
| Custom Tests Passed | ${customPassed} (${((customPassed / customResults.length) * 100).toFixed(1)}%) |
| Error Rate | ${((errorsProd / totalProd) * 100).toFixed(2)}% |
| Avg Latency | ${avgLatency.toFixed(0)}ms |
| Location Parse Rate | ${locationParseRate.toFixed(1)}% |

---

## Production Test Results

### Intent Distribution

| Intent | Count | Percentage |
|--------|-------|------------|
`;

  // Sort intents by count
  const sortedIntents = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);
  for (const [intent, count] of sortedIntents) {
    const pct = ((count / totalProd) * 100).toFixed(1);
    report += `| ${intent} | ${count.toLocaleString()} | ${pct}% |\n`;
  }

  report += `
### Performance Metrics

| Metric | Value |
|--------|-------|
| P50 Latency | ${p50Latency}ms |
| P95 Latency | ${p95Latency}ms |
| P99 Latency | ${p99Latency}ms |
| Average Latency | ${avgLatency.toFixed(0)}ms |

### Search Quality

| Metric | Value |
|--------|-------|
| Total Searches | ${searchesProd.length.toLocaleString()} |
| Searches with Results | ${searchesWithResults.toLocaleString()} (${((searchesWithResults / searchesProd.length) * 100).toFixed(1)}%) |
| Empty Searches | ${(searchesProd.length - searchesWithResults).toLocaleString()} |
| Avg Jobs per Search | ${(searchesProd.filter(r => r.atlasJobCount > 0).reduce((a, r) => a + r.atlasJobCount, 0) / searchesWithResults).toFixed(1)} |

### Location Parsing

| Metric | Value |
|--------|-------|
| Messages with City Names | ${withLocation.length.toLocaleString()} |
| Successfully Parsed | ${locationParsed.length.toLocaleString()} |
| Parse Rate | ${locationParseRate.toFixed(1)}% |

---

## Custom Test Results

### Overall Score

| Metric | Value |
|--------|-------|
| Total Tests | ${customResults.length} |
| Passed | ${customPassed} (${((customPassed / customResults.length) * 100).toFixed(1)}%) |
| Intent Accuracy | ${((customIntentCorrect / customResults.length) * 100).toFixed(1)}% |
| Location Accuracy | ${((customLocationCorrect / customResults.length) * 100).toFixed(1)}% |

### By Category

| Category | Passed | Total | Rate |
|----------|--------|-------|------|
`;

  for (const [cat, stats] of Object.entries(customByCategory)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    report += `| ${cat} | ${stats.passed} | ${stats.total} | ${rate}% |\n`;
  }

  report += `
### Failed Custom Tests

`;

  const failedCustom = customResults.filter(r => !r.passed);
  for (const r of failedCustom.slice(0, 20)) {
    report += `**#${r.testCase.id} [${r.testCase.category}]**: \`${r.testCase.input}\`
- Expected: ${JSON.stringify(r.testCase.expectedIntent)} → ${r.testCase.expectedOrigin || '-'}/${r.testCase.expectedDestination || '-'}
- Got: ${r.actualIntent} → ${r.actualOrigin || '-'}/${r.actualDestination || '-'}
${r.testCase.notes ? `- Notes: ${r.testCase.notes}` : ''}

`;
  }

  report += `
---

## Edge Cases Found

`;

  // Top edge cases by category
  for (const [category, cases] of Object.entries(edgeCasesByCategory)) {
    const highSeverity = cases.filter(c => c.severity === 'high');
    const sample = cases.slice(0, 5);

    report += `### ${category.replace(/_/g, ' ').toUpperCase()} (${cases.length} found, ${highSeverity.length} high severity)

`;

    for (const ec of sample) {
      report += `- **Message**: \`${ec.message.substring(0, 60)}${ec.message.length > 60 ? '...' : ''}\`
  - Intent: ${ec.intent}
  - Issue: ${ec.issue}
  - Severity: ${ec.severity}

`;
    }

    if (cases.length > 5) {
      report += `... and ${cases.length - 5} more\n\n`;
    }
  }

  report += `
---

## Top 10 Issues to Fix

`;

  // Prioritize issues
  const issues: { title: string; count: number; severity: string; examples: string[] }[] = [];

  // Issue 1: Location not parsed
  const locNotParsed = edgeCasesByCategory['location_not_parsed'] || [];
  if (locNotParsed.length > 0) {
    issues.push({
      title: 'City names in message not being parsed',
      count: locNotParsed.length,
      severity: 'HIGH',
      examples: locNotParsed.slice(0, 3).map(e => e.message),
    });
  }

  // Issue 2: Search misclassified
  const searchMisclass = edgeCasesByCategory['search_misclassified'] || [];
  if (searchMisclass.length > 0) {
    issues.push({
      title: 'Search-like messages classified incorrectly',
      count: searchMisclass.length,
      severity: 'MEDIUM',
      examples: searchMisclass.slice(0, 3).map(e => `"${e.message}" → ${e.intent}`),
    });
  }

  // Issue 3: Suffix confusion
  const suffixConf = edgeCasesByCategory['suffix_confusion'] || [];
  if (suffixConf.length > 0) {
    issues.push({
      title: 'Turkish suffix parsing confusion',
      count: suffixConf.length,
      severity: 'HIGH',
      examples: suffixConf.slice(0, 3).map(e => e.message),
    });
  }

  // Issue 4: Errors
  const errors = edgeCasesByCategory['error'] || [];
  if (errors.length > 0) {
    issues.push({
      title: 'Processing errors',
      count: errors.length,
      severity: 'HIGH',
      examples: errors.slice(0, 3).map(e => e.issue),
    });
  }

  // Issue 5: Custom test failures by category
  for (const [cat, stats] of Object.entries(customByCategory)) {
    if (stats.passed < stats.total) {
      const failedInCat = customResults.filter(r => r.testCase.category === cat && !r.passed);
      issues.push({
        title: `Custom test failures in ${cat}`,
        count: stats.total - stats.passed,
        severity: cat.includes('suffix') || cat.includes('basic') ? 'HIGH' : 'MEDIUM',
        examples: failedInCat.slice(0, 2).map(r => r.testCase.input),
      });
    }
  }

  // Sort by severity and count
  issues.sort((a, b) => {
    const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sevA = sevOrder[a.severity as keyof typeof sevOrder] ?? 2;
    const sevB = sevOrder[b.severity as keyof typeof sevOrder] ?? 2;
    if (sevA !== sevB) return sevA - sevB;
    return b.count - a.count;
  });

  for (let i = 0; i < Math.min(10, issues.length); i++) {
    const issue = issues[i];
    report += `### ${i + 1}. ${issue.title}

- **Count**: ${issue.count}
- **Severity**: ${issue.severity}
- **Examples**:
${issue.examples.map(e => `  - \`${e}\``).join('\n')}

`;
  }

  report += `
---

## Recommendations

1. **Improve Turkish suffix parsing**: Many messages with clear -dan/-den suffixes are not being parsed correctly
2. **Handle city abbreviations**: Common shortcuts like "ist", "ank", "antep" should be recognized
3. **Multi-destination parsing**: "istanbul ankara izmir" patterns need better handling
4. **Region detection**: "ege bolgesi", "marmara" should trigger region searches
5. **Error handling**: Review and fix processing errors

## Files Generated

- \`results.jsonl\`: ${totalProd.toLocaleString()} production test results
- \`custom-results.jsonl\`: ${customResults.length} custom test results
- \`report.md\`: This analysis report
`;

  // Write report
  fs.writeFileSync(REPORT_FILE, report);

  console.log('\n=== Report Generated ===');
  console.log(`Output: ${REPORT_FILE}`);
  console.log('\nKey Findings:');
  console.log(`  - Production messages: ${totalProd.toLocaleString()}`);
  console.log(`  - Custom tests: ${customPassed}/${customResults.length} passed (${((customPassed / customResults.length) * 100).toFixed(1)}%)`);
  console.log(`  - Error rate: ${((errorsProd / totalProd) * 100).toFixed(2)}%`);
  console.log(`  - Location parse rate: ${locationParseRate.toFixed(1)}%`);
  console.log(`  - Edge cases found: ${edgeCases.length}`);
}

// Run
generateReport()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nError:', err);
    process.exit(1);
  });
