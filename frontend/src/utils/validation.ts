/**
 * Validates that a phone number contains exactly 10 digits and only numbers.
 * Reject country codes, spaces, or special characters.
 */
export const validatePhone = (phone: string): boolean => {
  return /^\d{10}$/.test(phone);
};

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

