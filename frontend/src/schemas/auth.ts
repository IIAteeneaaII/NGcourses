import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

const passwordField = z
  .string()
  .min(8, 'La contraseña debe tener mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una mayúscula')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una minúscula')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número')
  .regex(/[^\p{L}\p{N}\s]/u, 'La contraseña debe incluir al menos un carácter especial');

export const ResetPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine(d => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

export const ActivarCuentaSchema = z
  .object({
    password: passwordField,
    confirm: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine(d => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

export type LoginData = z.infer<typeof LoginSchema>;
export type ForgotPasswordData = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof ResetPasswordSchema>;
export type ActivarCuentaData = z.infer<typeof ActivarCuentaSchema>;
