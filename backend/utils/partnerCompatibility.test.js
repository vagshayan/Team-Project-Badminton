const test = require('node:test');
const assert = require('node:assert/strict');
const { isPartnerCompatible, getPartnerCompatibilityError } = require('./partnerCompatibility');

test('allows same-gender pairings for doubles women', () => {
  assert.equal(isPartnerCompatible('doubles-women', 'Female', 'Female'), true);
  assert.equal(getPartnerCompatibilityError('doubles-women', 'Female', 'Female'), null);
});

test('allows same-gender pairings for doubles men', () => {
  assert.equal(isPartnerCompatible('doubles-men', 'Male', 'Male'), true);
  assert.equal(getPartnerCompatibilityError('doubles-men', 'Male', 'Male'), null);
});

test('requires opposite genders for mixed doubles', () => {
  assert.equal(isPartnerCompatible('mixed-doubles', 'Male', 'Female'), true);
  assert.equal(isPartnerCompatible('mixed-doubles', 'male', 'female'), true);
  assert.equal(isPartnerCompatible('mixed-doubles', 'Male', 'Male'), false);
  assert.equal(getPartnerCompatibilityError('mixed-doubles', 'Male', 'Male'), 'Mixed Doubles requires one male and one female player.');
});

test('allows lowercase gender values for doubles women', () => {
  assert.equal(isPartnerCompatible('doubles-women', 'female', 'female'), true);
  assert.equal(getPartnerCompatibilityError('doubles-women', 'female', 'female'), null);
});

test('allows lowercase gender values for doubles men', () => {
  assert.equal(isPartnerCompatible('doubles-men', 'male', 'male'), true);
  assert.equal(getPartnerCompatibilityError('doubles-men', 'male', 'male'), null);
});
