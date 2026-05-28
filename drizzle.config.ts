import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema/index.ts',
  out: './src/lib/migrations',
  dialect: 'sqlite',
} satisfies Config;
