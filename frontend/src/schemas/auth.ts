import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

const passwordField = z.string().min(8, 'Mínimo 8 caracteres').max(128, 'Máximo 128 caracteres');

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
