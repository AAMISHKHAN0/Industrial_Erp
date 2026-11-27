export const DLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="40" height="40" rx="10" className="fill-primary" fill="#2563eb" />
    <path
      d="M10 30V10H18C22.5 10 26 11.5 28 14.5C30 17.5 30 22.5 28 25.5 26 28.5 22.5 30 18 30H10ZM16 24H18C20.5 24 22.5 23 23.5 21 24.5 19 24.5 15 23.5 13 22.5 11 20.5 10 18 10H16V24Z"
      fill="white"
    />
  </svg>
);