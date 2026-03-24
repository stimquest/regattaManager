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
