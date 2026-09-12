import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number;
  strokeWidth?: number;
};

function icon(children: ReactNode) {
  return function Icon({ size = 24, strokeWidth = 2, ...props }: IconProps) {
    return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
  };
}

export const ArrowRight = icon(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
export const Check = icon(<path d="m5 12 4 4L19 6" />);
export const CheckCircle2 = icon(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>);
export const AlertCircle = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 17h.01" /></>);
export const AlertTriangle = icon(<><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);
export const CircleHelp = icon(<><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 2-2.4 2.1-2.4 4" /><path d="M12 18h.01" /></>);
export const Radio = icon(<><circle cx="12" cy="12" r="2" /><circle cx="12" cy="12" r="7" /></>);
export const Home = icon(<><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>);
export const Menu = icon(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>);
export const X = icon(<><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>);
export const ChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const ExternalLink = icon(<><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v6H5V6h6" /></>);
export const Copy = icon(<><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>);
export const Download = icon(<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>);
export const Upload = icon(<><path d="M12 21V9" /><path d="m7 14 5-5 5 5" /><path d="M5 4h14" /></>);
export const Play = icon(<path d="m8 5 11 7-11 7V5Z" />);
export const Clock3 = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const BookOpen = icon(<><path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22V5.5Z" /><path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22V5.5Z" /></>);
export const Code2 = icon(<><path d="m9 18-6-6 6-6" /><path d="m15 6 6 6-6 6" /></>);
export const Terminal = icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3" /><path d="M13 15h4" /></>);
export const Database = icon(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>);
export const Eye = icon(<><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>);
export const Network = icon(<><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-2h14v2" /></>);
export const Layers3 = icon(<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>);
export const FileSearch = icon(<><path d="M6 2h8l4 4v7" /><path d="M14 2v5h5" /><path d="M6 2a2 2 0 0 0-2 2v16h7" /><circle cx="16" cy="17" r="3" /><path d="m18.5 19.5 2 2" /></>);
export const ScanSearch = icon(<><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><circle cx="11" cy="11" r="3" /><path d="m13.5 13.5 3 3" /></>);
export const FileCheck2 = icon(<><path d="M6 2h8l4 4v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v5h5" /><path d="m8 14 2 2 4-5" /></>);
export const FileJson = icon(<><path d="M6 2h8l4 4v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v5h5" /><path d="M9 11c-1 0-1 .7-1 1.5S8 14 7 14M15 11c1 0 1 .7 1 1.5S16 14 17 14" /></>);
export const FileClock = icon(<><path d="M6 2h8l4 4v6" /><path d="M14 2v5h5" /><path d="M6 2a2 2 0 0 0-2 2v16h7" /><circle cx="16" cy="17" r="4" /><path d="M16 15v2l1.5 1" /></>);
export const ShieldCheck = icon(<><path d="M12 3 4 6v5c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-3Z" /><path d="m8.5 12 2 2 5-5" /></>);
export const ShieldAlert = icon(<><path d="M12 3 4 6v5c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-3Z" /><path d="M12 8v5" /><path d="M12 17h.01" /></>);
export const LockKeyhole = icon(<><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15" r="1" /><path d="M12 16v2" /></>);
export const KeyRound = icon(<><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8" /><path d="m16 7 2 2" /><path d="m14 9 2 2" /></>);
export const LoaderCircle = icon(<><path d="M21 12a9 9 0 0 1-9 9" /><path d="M3 12a9 9 0 0 1 9-9" /></>);
