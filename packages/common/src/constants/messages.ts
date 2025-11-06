export const AUTH_MESSAGES = {
  nameRequired: "Name is required",
  nameInvalid: "Full name can only contain letters, spaces, and hyphens.",
  nameTooShort: "Full name must contain at least two words.",
  emailInvalid: "Enter a valid email",
  passwordTooShort: (n: number) => `Password must be at least ${n} characters`,
  passwordUppercase: "Password must contain at least one uppercase letter.",
  passwordLowercase: "Password must contain at least one lowercase letter.",
  passwordNumber: "Password must contain at least one number.",
  passwordSpecialChar: "Password must contain at least one special character.",
} as const;
