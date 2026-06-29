import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  full_name: z.string().max(255).optional().or(z.literal('')),
  organizacion_id: z.string().uuid('Selecciona una organización'),
});

export const EditUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  full_name: z.string().max(255).optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128)
    .optional()
    .or(z.literal('')),
  rol: z.enum(['estudiante', 'instructor', 'supervisor', 'administrador']).optional(),
  is_active: z.boolean().optional(),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>;
export type EditUserData = z.infer<typeof EditUserSchema>;
