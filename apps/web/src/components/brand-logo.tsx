import Image from "next/image";

type BrandLogoProps = {
  variant?: "sidebar" | "login" | "compact";
};

export function BrandLogo({ variant = "sidebar" }: BrandLogoProps) {
  const sizes = {
    sidebar: { w: 168, h: 52 },
    login: { w: 220, h: 68 },
    compact: { w: 120, h: 38 },
  }[variant];

  return (
    <div className={`brand-logo brand-logo--${variant}`}>
      <Image
        src="/logo.png"
        alt="Sulnet — A gente vive online"
        width={sizes.w}
        height={sizes.h}
        priority
        className="brand-logo-img"
      />
    </div>
  );
}
