import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrationPhone } from './registration-phone.util';

test('registrationPhone uses the phone saved at signup', () => {
  assert.equal(registrationPhone({ phoneNumber: '+998901112233' }), '+998901112233');
});

test('registrationPhone reads the phone from the registration email', () => {
  assert.equal(
    registrationPhone({ email: '998907778899@mexrliqollar.uz' }),
    '+998907778899',
  );
});

test('registrationPhone reads a phone kept inside personal info', () => {
  assert.equal(registrationPhone({ personalInfo: { phone: '901234567' } }), '+998901234567');
});

test('registrationPhone returns null when the account has no registration phone', () => {
  assert.equal(registrationPhone({ email: 'user@example.com', phoneNumber: '' }), null);
});
