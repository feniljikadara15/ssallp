import clsx from "clsx";

// Company mark. The artwork is public/logo.png (white on navy); until it's
// added, an "SA" monogram in the same colours stands in.
export const LOGO_SRC: string | null = null;

export function Logo({ className }: { className?: string }) {
  if (LOGO_SRC) return <img src={LOGO_SRC} alt="Sambhavnath Agencies LLP" className={clsx("object-contain", className)} />;
  return (
    <div aria-label="Sambhavnath Agencies LLP" className={clsx("grid place-items-center rounded-xl bg-secondary font-serif text-lg italic text-white ring-1 ring-white/15", className)}>
      SA
    </div>
  );
}
