function normalizeGender(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPartnerCompatible(category, playerGender, partnerGender) {
  if (!category) return false;

  if (category === 'mixed-doubles') {
    const player = normalizeGender(playerGender);
    const partner = normalizeGender(partnerGender);
    return Boolean(
      (player === 'male' && partner === 'female') ||
      (player === 'female' && partner === 'male')
    );
  }

  if (category === 'doubles-men') {
    const player = normalizeGender(playerGender);
    const partner = normalizeGender(partnerGender);
    return (!player || player === 'male') && (!partner || partner === 'male');
  }

  if (category === 'doubles-women') {
    const player = normalizeGender(playerGender);
    const partner = normalizeGender(partnerGender);
    return (!player || player === 'female') && (!partner || partner === 'female');
  }

  return false;
}

function getPartnerCompatibilityError(category, playerGender, partnerGender) {
  if (!category) return 'Partner compatibility could not be checked.';

  if (category === 'mixed-doubles') {
    if (!normalizeGender(playerGender) || !normalizeGender(partnerGender)) {
      return 'Both players must have gender set for Mixed Doubles.';
    }

    return isPartnerCompatible(category, playerGender, partnerGender)
      ? null
      : 'Mixed Doubles requires one male and one female player.';
  }

  if (category === 'doubles-men') {
    return isPartnerCompatible(category, playerGender, partnerGender)
      ? null
      : 'Doubles Men requires two male players.';
  }

  if (category === 'doubles-women') {
    return isPartnerCompatible(category, playerGender, partnerGender)
      ? null
      : 'Doubles Women requires two female players.';
  }

  return null;
}

module.exports = {
  isPartnerCompatible,
  getPartnerCompatibilityError,
};
