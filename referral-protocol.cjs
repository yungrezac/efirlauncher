'use strict';

const normalizeCode = value => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{2,39}$/.test(code) ? code : null;
};

function parseReferralUrl(value) {
  if (typeof value !== 'string' || value.length > 256) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'efir:' || url.hostname !== 'referral' || !['', '/'].includes(url.pathname)
      || url.username || url.password || url.port || url.hash
      || [...url.searchParams.keys()].some(key => key !== 'code')
      || url.searchParams.getAll('code').length !== 1) return null;
    return normalizeCode(url.searchParams.get('code'));
  } catch { return null; }
}

module.exports = { normalizeCode, parseReferralUrl };
