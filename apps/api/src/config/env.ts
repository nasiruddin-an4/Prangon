import { z } from 'zod';

/** Environment variables, validated once at startup: a typo fails fast, not at the first request. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters (openssl rand -base64 32)'),
  JWT_ISSUER: z.url().default('http://localhost:4000'),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = (): Env => validateEnv(process.env);
