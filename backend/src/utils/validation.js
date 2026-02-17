import sanitizeHtml from 'sanitize-html';

export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  return sanitizeHtml(input, {
    allowedTags: [], // tags HTML non autorises
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}

function validateNumeric(value, fieldName) {
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number`);
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number (not NaN or Infinity)`);
  }

  return value;
}

export function validateScore(score, fieldName) {
  const validatedScore = validateNumeric(score, fieldName);

  if (validatedScore < 0 || validatedScore > 100) {
    throw new Error(`${fieldName} must be between 0 and 100`);
  }

  return validatedScore;
}

export function validateEmail(email) {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string');
  }

  const sanitized = sanitizeInput(email.trim().toLowerCase());

  if (sanitized.length > 100) {
    throw new Error('Email must be at most 100 characters');
  }

  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
}

export function validateUsername(username, minLength = 3, maxLength = 20) {
  if (typeof username !== 'string') {
    throw new Error('Username must be a string');
  }

  const sanitized = sanitizeInput(username);

  if (sanitized.length < minLength) {
    throw new Error(`Username must be at least ${minLength} characters`);
  }

  if (sanitized.length > maxLength) {
    throw new Error(`Username must be at most ${maxLength} characters`);
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(sanitized)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return sanitized;
}

export function validateDisplayName(displayName, maxLength = 20) {
  if (typeof displayName !== 'string') {
    throw new Error('Display name must be a string');
  }

  const sanitized = sanitizeInput(displayName.trim());

  if (sanitized.length === 0) {
    throw new Error('Display name cannot be empty');
  }

  if (sanitized.length < 2) {
    throw new Error('Display name must be at least 2 characters');
  }

  if (sanitized.length > maxLength) {
    throw new Error(`Display name must be at most ${maxLength} characters`);
  }

  const displayNameRegex = /^[\p{L}\p{N}_\-\s]+$/u;
  if (!displayNameRegex.test(sanitized)) {
    throw new Error('Display name can only contain letters, numbers, spaces, underscores, and hyphens');
  }

  return sanitized;
}

export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    throw new Error('Password must not exceed 128 characters');
  }

  if (/[\x00-\x1F\x7F]/.test(password)) {
    throw new Error('Password cannot contain control characters');
  }

  return true;
}
