import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClient, dedupeRecipients, toCsv, parseCsv } from '../web/src/components/utils.js';
import { normalizeFiltersData } from '../functions/filter-utils.js';

test('validateClient catches invalid payload', () => {
  const errors = validateClient({ name: '', email: 'bad', phone: '12' });
  assert.ok(errors.length >= 2);
});

test('dedupeRecipients removes duplicates and opt-outs', () => {
  const result = dedupeRecipients(['+2331', '+2331', '+2332'], new Set(['+2332']));
  assert.deepEqual(result, { recipients: ['+2331'], duplicateCount: 1, optOutCount: 1 });
});

test('toCsv and parseCsv handle quoted commas', () => {
  const csv = toCsv([{ name: 'Jane, Doe', email: 'jane@example.com' }]);
  const parsed = parseCsv(csv);
  assert.equal(parsed.records[0].record.name, 'Jane, Doe');
});

test('normalizeFiltersData validates range and trims program', () => {
  const normalized = normalizeFiltersData({ startDate: '2025-01-01', endDate: '2025-01-07', program: ' oncology ' });
  assert.equal(normalized.program, 'oncology');
  assert.throws(() => normalizeFiltersData({ startDate: '2025-01-02', endDate: '2025-01-01' }), /before/);
});
