import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'primary'
  | 'secondary';

export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  rounded?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'medium',
  dot = false,
  rounded = false,
  className = '',
  children,
  ...props
}) => {
  const badgeClasses = [
    styles.badge,
    styles[variant],
    styles[size],
    dot ? styles.dot : '',
    rounded ? styles.rounded : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={badgeClasses} {...props}>
      {dot && <span className={styles.dotIndicator} />}
      {children}
    </span>
  );
};

// Status Badge helpers for common use cases
export const StatusBadge: React.FC<{
  status: 'active' | 'inactive' | 'suspended' | 'pending' | 'approved' | 'rejected';
  size?: BadgeSize;
}> = ({ status, size = 'medium' }) => {
  const variantMap: Record<typeof status, BadgeVariant> = {
    active: 'success',
    inactive: 'default',
    suspended: 'error',
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
  };

  const labelMap: Record<typeof status, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    suspended: 'Suspendido',
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };

  return (
    <Badge variant={variantMap[status]} size={size}>
      {labelMap[status]}
    </Badge>
  );
};

// Course Status Badge
export const CourseStatusBadge: React.FC<{
  status: 'draft' | 'published' | 'archived';
  size?: BadgeSize;
}> = ({ status, size = 'medium' }) => {
  const variantMap: Record<typeof status, BadgeVariant> = {
    draft: 'default',
    published: 'success',
    archived: 'warning',
  };

  const labelMap: Record<typeof status, string> = {
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
  };

  return (
    <Badge variant={variantMap[status]} size={size}>
      {labelMap[status]}
    </Badge>
  );
};

// Priority Badge
export const PriorityBadge: React.FC<{
  priority: 'low' | 'medium' | 'high';
  size?: BadgeSize;
}> = ({ priority, size = 'medium' }) => {
  const variantMap: Record<typeof priority, BadgeVariant> = {
    low: 'default',
    medium: 'warning',
    high: 'error',
  };

  const labelMap: Record<typeof priority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
  };

  return (
    <Badge variant={variantMap[priority]} size={size}>
      {labelMap[priority]}
    </Badge>
  );
};
