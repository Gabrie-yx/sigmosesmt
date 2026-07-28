import { z } from "zod";

export const tokenSchema = z.string().uuid();
