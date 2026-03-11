import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClient, dedupeRecipients, paginate, toCsv } from '../web/src/components/utils.js';

test('validateClient catches invalid email and phone', () => {
  const errors = validateClient({ name: 'A', email: 'bad', phone: '123', notes: '' });
  assert.ok(errors.length >= 2);
});

test('dedupeRecipients removes duplicates and opt-outs', () => {
  const result = dedupeRecipients(['+1', '+1', '+2'], new Set(['+2']));
  assert.deepEqual(result.recipients, ['+1']);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.optOutCount, 1);
});

test('paginate returns expected page', () => {
  const result = paginate([1, 2, 3, 4, 5, 6], 2, 2);
  assert.deepEqual(result.items, [3, 4]);
});

test('toCsv serializes rows', () => {
  const csv = toCsv([{ a: 1, b: 'x' }]);
  assert.equal(csv.trim(), 'a,b\n1,x');
});
