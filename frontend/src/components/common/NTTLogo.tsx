interface NTTLogoProps {
  size?: number;
  className?: string;
}

export default function NTTLogo({ size = 40, className = '' }: NTTLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="40" height="40" rx="8" fill="#E60012" />
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="800"
        fontFamily="Inter, Arial, sans-serif"
        letterSpacing="0.5"
      >
        NTT
      </text>
    </svg>
  );
}
