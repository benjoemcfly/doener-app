// src/lib/db.ts
import { neon } from '@neondatabase/serverless';

const url = process.env.POSTGRES_URL;
if (!url) {
  throw new Error('POSTGRES_URL is not set');
}

export const sql = neon(url);