import { z } from 'zod';

const passwordField = z.string().min(8, 'Mínimo 8 caracteres').max(128, 'Máximo 128 caracteres');

export const EditProfileSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres').max(255).optional().or(z.literal('')),
  email: z.string().email('Correo electrónico inválido'),
  telefono: z.string().max(20, 'Máximo 20 caracteres').optional().or(z.literal('')),
});

export const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, 'Ingresa tu contraseña actual'),
    nueva: passwordField,
    confirmar: z.string().min(1, 'Confirma tu nueva contraseña'),
  })
  .refine(d => d.nueva === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  });

export const ProfileSetupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(255),
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type EditProfileData = z.infer<typeof EditProfileSchema>;
export type ChangePasswordData = z.infer<typeof ChangePasswordSchema>;
export type ProfileSetupData = z.infer<typeof ProfileSetupSchema>;
