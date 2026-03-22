import Image from "next/image";
import type { ComponentProps } from "react";

const LOGO_SRC = "/logo-macetero.png";

/** Dimensiones del PNG en `public/logo-macetero.png` (recorte real). */
const INTRINSIC_W = 367;
const INTRINSIC_H = 297;

export type MaceteroLogoProps = Omit<
  ComponentProps<typeof Image>,
  "src" | "alt" | "width" | "height"
> & {
  variant?: "full" | "mark";
  /** `light`: fondo oscuro (marca con letras negras sobre taco claro). `dark`: fondo claro. */
  tone?: "light" | "dark";
};

/**
 * Marca Macetero desde `public/logo-macetero.png` (icono + wordmark).
 * `mark` = mismo asset, más compacto (solo altura menor en uso típico).
 */
export function MaceteroLogo({
  variant = "full",
  tone = "light",
  className,
  ...props
}: MaceteroLogoProps) {
  const needsLightBacking = tone === "light";

  const img = (
    <Image
      src={LOGO_SRC}
      alt="Macetero"
      width={INTRINSIC_W}
      height={INTRINSIC_H}
      className={["max-h-full w-auto max-w-full object-contain object-left", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      sizes="(max-width: 768px) 50vw, 200px"
      {...props}
    />
  );

  const pad =
    variant === "mark" && needsLightBacking
      ? "px-1 py-0.5"
      : needsLightBacking
        ? "px-1.5 py-1"
        : "";

  if (!needsLightBacking) {
    return <span className="inline-flex max-w-full items-center">{img}</span>;
  }

  return (
    <span
      className={`inline-flex w-fit max-w-full shrink-0 items-center justify-center rounded-md bg-white/95 shadow-sm ring-1 ring-black/10 ${pad}`}
    >
      {img}
    </span>
  );
}
