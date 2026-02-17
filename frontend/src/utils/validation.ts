export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();

  if (!trimmed) {
    return { valid: false, error: 'Username is required' };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must contain at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username cannot exceed 20 characters' };
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, _ or -' };
  }

  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Email cannot exceed 100 characters' };
  }

  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

export function validateDisplayName(displayName: string): ValidationResult {
  const trimmed = displayName.trim();

  if (!trimmed) {
    return { valid: false, error: 'Display name is required' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Display name must contain at least 2 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Display name cannot exceed 20 characters' };
  }

  const displayNameRegex = /^[\p{L}\p{N}_\-\s]+$/u;
  if (!displayNameRegex.test(trimmed)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, spaces, _ or -' };
  }

  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must contain at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters' };
  }

  return { valid: true };
}

export function validatePasswordConfirm(password: string, passwordConfirm: string): ValidationResult {
  if (!passwordConfirm) {
    return { valid: false, error: 'Password confirmation is required' };
  }

  if (password !== passwordConfirm) {
    return { valid: false, error: 'Passwords do not match' };
  }

  return { valid: true };
}

export function validateTournamentAlias(alias: string): ValidationResult {
  const trimmed = alias.trim();
  if (!trimmed) {
    return { valid: false, error: 'Alias is required' };
  }
  if (trimmed.length > 20) {
    return { valid: false, error: 'Alias cannot exceed 20 characters' };
  }
  return { valid: true };
}

export function validateRegistrationForm(data: {
  username: string;
  email: string;
  displayName: string;
  password: string;
  passwordConfirm: string;
}): ValidationResult {
  const usernameResult = validateUsername(data.username);
  if (!usernameResult.valid) return usernameResult;

  const emailResult = validateEmail(data.email);
  if (!emailResult.valid) return emailResult;

  const displayNameResult = validateDisplayName(data.displayName);
  if (!displayNameResult.valid) return displayNameResult;

  const passwordResult = validatePassword(data.password);
  if (!passwordResult.valid) return passwordResult;

  const confirmResult = validatePasswordConfirm(data.password, data.passwordConfirm);
  if (!confirmResult.valid) return confirmResult;

  return { valid: true };
}

export function validateLoginForm(data: {
  username: string;
  password: string;
}): ValidationResult {
  const trimmedUsername = data.username.trim();

  if (!trimmedUsername) {
    return { valid: false, error: 'Username is required' };
  }

  if (!data.password) {
    return { valid: false, error: 'Password is required' };
  }

  return { valid: true };
}
