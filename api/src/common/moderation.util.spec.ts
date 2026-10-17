import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moderateText } from './moderation.util';

test('ordinary chat stays allowed', () => {
  assert.equal(moderateText('Ertaga soat 9 da kelaman').allowed, true);
});

test('blocked categories stay blocked', () => {
  assert.equal(moderateText('this is porn').violationType, 'adult_content');
  assert.equal(moderateText('I will kill you').violationType, 'harassment');
  assert.equal(moderateText('tel +998901112233').violationType, 'external_contact');
  assert.equal(moderateText('what the fuck').violationType, 'profanity');
});
