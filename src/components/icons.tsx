import type { SVGProps } from "react";

export function Sailboat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 18H2a2.5 2.5 0 0 0-2 2.5V21h24v-.5a2.5 2.5 0 0 0-2-2.5Z" />
      <path d="M20.5 18A5.5 5.5 0 0 0 15 12.5V3L5 12.5V18Z" />
      <path d="M15 3v9.5" />
    </svg>
  );
}

/** Marque de l'app : un pavillon de signalisation, diagonale orange sur voile claire. */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="9" fill="hsl(var(--ink))" />
      <rect x="9" y="6.5" width="1.8" height="19" rx="0.9" fill="hsl(var(--ink-foreground))" />
      <path d="M10.8 7h13.7v10.8H10.8z" fill="hsl(var(--ink-foreground))" />
      <path d="M10.8 7h13.7L10.8 17.8z" fill="hsl(var(--signal))" />
    </svg>
  );
}
