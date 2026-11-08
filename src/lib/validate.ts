import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const isUuid = (value: unknown): value is string => uuidSchema.safeParse(value).success;
