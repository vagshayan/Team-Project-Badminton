const sanitizeInput = (val) => {
  if (typeof val === 'string') {
    return val
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+)/gi, '')
      .replace(/javascript:/gi, '');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeInput);
  }
  if (val !== null && typeof val === 'object') {
    const sanitized = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        // NoSQL Injection mitigation: strip keys starting with "$"
        if (key.startsWith('$')) continue;
        sanitized[key] = sanitizeInput(val[key]);
      }
    }
    return sanitized;
  }
  return val;
};

// Middleware to recursively sanitize request inputs against XSS and NoSQL injections
const securitySanitizer = (req, res, next) => {
  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
  next();
};

module.exports = {
  securitySanitizer,
  securityHeaders
};
