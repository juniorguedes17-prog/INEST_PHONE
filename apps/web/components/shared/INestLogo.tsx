import Image from 'next/image';
import { cn } from '@/utils/cn';

type INestLogoVariant = 'compact' | 'default' | 'navigation' | 'login';

interface INestLogoProps {
  variant?: INestLogoVariant;
  className?: string;
  priority?: boolean;
}

export function INestLogo({ variant = 'default', className, priority = false }: INestLogoProps) {
  return (
    <span
      className={cn('inest-logo', `inest-logo--${variant}`, className)}
      role="img"
      aria-label="iNest Phone — iPhone, iPad, MacBook"
    >
      <Image
        src="/brand/inest-phone-logo.png"
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 640px) 160px, 460px"
        className="inest-logo__asset inest-logo__asset--light"
      />
      <Image
        src="/brand/inest-phone-logo-dark.png"
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 640px) 160px, 460px"
        className="inest-logo__asset inest-logo__asset--dark"
      />
    </span>
  );
}
