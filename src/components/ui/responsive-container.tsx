import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  breakout?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const maxWidthMap = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  'full': 'max-w-full',
};

export function ResponsiveContainer({
  as: Component = 'div',
  children,
  className,
  breakout = false,
  maxWidth = 'xl',
  ...props
}: ResponsiveContainerProps) {
  return (
    <Component
      className={cn(
        'w-full mx-auto px-4 sm:px-6 md:px-8',
        breakout ? 'max-w-full' : maxWidthMap[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: string;
}

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 'gap-4',
  ...props
}: ResponsiveGridProps) {
  const getColsClass = () => {
    const classes = [`grid-cols-${cols.default}`];
    
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    
    return classes.join(' ');
  };

  return (
    <div
      className={cn(
        'grid',
        getColsClass(),
        gap,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}