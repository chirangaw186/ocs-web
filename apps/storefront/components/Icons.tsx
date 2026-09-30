import type { ReactNode } from "react";

function Icon({ size = 22, width = 1.4, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const BagIcon = () => <Icon><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></Icon>;
export const MenuIcon = () => <Icon><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;

export const DressFormIcon = () => (
  <Icon size={26} width={1.3}>
    <path d="M9 3h6M12 3v2M8.5 5h7c0 3-1.5 4.5-1.5 6.5s2 4 2 7.5H8c0-3.5 2-5.5 2-7.5S8.5 8 8.5 5z" /><path d="M12 19v2M9.5 21h5" />
  </Icon>
);
export const LeafIcon = () => <Icon size={26} width={1.3}><path d="M5 19C5 10 11 5 19 5c0 8-5 14-14 14z" /><path d="M5 19l9-9" /></Icon>;
export const SparkleIcon = () => (
  <Icon size={26} width={1.3}><path d="M12 3c.7 5 2.5 7.3 8 9-5.5 1.7-7.3 4-8 9-.7-5-2.5-7.3-8-9 5.5-1.7 7.3-4 8-9z" /></Icon>
);
export const HangerIcon = () => <Icon size={26} width={1.3}><path d="M12 8a2 2 0 1 1 2-2c0 1-2 1.5-2 3" /><path d="M12 9L3 16h18l-9-7z" /></Icon>;
