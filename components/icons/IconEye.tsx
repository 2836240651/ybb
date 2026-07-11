type IconEyeProps = {
  className?: string;
};

/** OMC icon-eye viewBox 0 0 16 16 */
export function IconEye({ className }: IconEyeProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      stroke="currentColor"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M14.6666 7.99999C14.6666 9.66666 12.6666 13.3333 7.99992 13.3333C3.33325 13.3333 1.33325 9.66666 1.33325 7.99999C1.33325 6.33332 3.33325 2.66666 7.99992 2.66666C12.6666 2.66666 14.6666 6.33332 14.6666 7.99999Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M7.99992 10C9.10449 10 9.99992 9.10457 9.99992 8C9.99992 6.89543 9.10449 6 7.99992 6C6.89535 6 5.99992 6.89543 5.99992 8C5.99992 9.10457 6.89535 10 7.99992 10Z"
      />
    </svg>
  );
}
