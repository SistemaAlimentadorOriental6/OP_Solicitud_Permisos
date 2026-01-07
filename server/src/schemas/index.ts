import { z } from 'zod';

export const LoginSchema = z.object({
  code: z.string().default(''),
  password: z.string().min(1, 'La contraseña es requerida')
});

export const UpdatePhoneSchema = z.object({
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos')
});

export const PermitRequestSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
  dates: z.array(z.string()).min(1, 'Debe seleccionar al menos una fecha'),
  noveltyType: z.string().min(1, 'El tipo de novedad es requerido'),
  time: z.string().optional(),
  description: z.string().optional()
});

export const PermitRequest2Schema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
  dates: z.array(z.string()).min(1, 'Debe seleccionar al menos una fecha'),
  noveltyType: z.string().min(1, 'El tipo de novedad es requerido'),
  time: z.string().optional(),
  description: z.string().optional()
});

export const EquipmentRequestSchema = z.object({
  type: z.string().min(1, 'El tipo es requerido'),
  description: z.string().optional().nullable(),
  zona: z.string().optional().nullable(),
  codeAM: z.string().optional().nullable(),
  codePM: z.string().optional().nullable(),
  shift: z.string().optional().nullable()
});

export const ApprovalUpdateSchema = z.object({
  approved_by: z.string().min(1, 'El campo approved_by es requerido')
});

export const NotificationStatusUpdateSchema = z.object({
  notification_status: z.string().min(1, 'El estado de notificación es requerido')
});

export const UserSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  role: z.string().optional(),
  cargo: z.string().optional()
});

export const DateCheckSchema = z.object({
  dates: z.array(z.string()).min(1, 'Debe proporcionar al menos una fecha')
});

export const RequestUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  respuesta: z.string().optional()
});

export const HistoryParamsSchema = z.object({
  code: z.string().min(1, 'El código es requerido')
});

export const WeekQuerySchema = z.object({
  week: z.string().transform(val => parseInt(val, 10)).optional()
});

export const RequestIdSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10))
});

export const UserCodeSchema = z.object({
  code: z.string().min(1, 'El código es requerido')
});

export const FileNameSchema = z.object({
  filename: z.string().min(1, 'El nombre del archivo es requerido')
});

// Tipos inferidos de los esquemas
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdatePhoneInput = z.infer<typeof UpdatePhoneSchema>;
export type PermitRequestInput = z.infer<typeof PermitRequestSchema>;
export type PermitRequest2Input = z.infer<typeof PermitRequest2Schema>;
export type EquipmentRequestInput = z.infer<typeof EquipmentRequestSchema>;
export type ApprovalUpdateInput = z.infer<typeof ApprovalUpdateSchema>;
export type NotificationStatusUpdateInput = z.infer<typeof NotificationStatusUpdateSchema>;
export type UserInput = z.infer<typeof UserSchema>;
export type DateCheckInput = z.infer<typeof DateCheckSchema>;
export type RequestUpdateInput = z.infer<typeof RequestUpdateSchema>;
export type HistoryParamsInput = z.infer<typeof HistoryParamsSchema>;
export type WeekQueryInput = z.infer<typeof WeekQuerySchema>;
export type RequestIdInput = z.infer<typeof RequestIdSchema>;
export type UserCodeInput = z.infer<typeof UserCodeSchema>;
export type FileNameInput = z.infer<typeof FileNameSchema>; 