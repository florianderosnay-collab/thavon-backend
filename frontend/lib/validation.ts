import { z } from "zod";

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .min(1, "Email is required")
  .max(255, "Email is too long");

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    "Password must contain at least one special character"
  );

/**
 * Phone number validation schema (flexible - accepts various formats)
 */
export const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .regex(/^[\d\s\-\+\(\)]+$/, "Invalid phone number format")
  .max(20, "Phone number is too long");

/**
 * Agency name validation schema
 */
export const agencyNameSchema = z
  .string()
  .min(1, "Company name is required")
  .max(255, "Company name is too long")
  .regex(/^[a-zA-Z0-9\s\-_&.,'()]+$/, "Company name contains invalid characters");

/**
 * Lead name validation schema
 */
export const leadNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name is too long")
  .regex(/^[a-zA-Z\s\-'.,]+$/, "Name contains invalid characters");

/**
 * Address validation schema
 */
export const addressSchema = z
  .string()
  .max(500, "Address is too long")
  .optional();

/**
 * Property value validation schema
 */
export const propertyValueSchema = z
  .string()
  .regex(/^[\d,.\s€$]+$/, "Invalid property value format")
  .optional();

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * Password reset request schema
 */
export const passwordResetSchema = z.object({
  email: emailSchema,
});

/**
 * Lead creation schema
 */
export const leadSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: phoneSchema,
  email: emailSchema.optional(),
  address: addressSchema,
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  propertyType: z.string().max(50).optional(),
  propertyValue: propertyValueSchema,
  leadSource: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Settings update schema
 */
export const settingsSchema = z.object({
  companyName: agencyNameSchema,
  phone: phoneSchema.optional(),
});

/**
 * Sanitize string input (remove potentially dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize email (lowercase and trim)
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Validate and sanitize input using a Zod schema
 */
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    return { success: false, error: "Validation failed" };
  }
}

