import Image from "next/image";

export function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="mx-auto mt-14 flex w-full max-w-5xl flex-col items-center gap-4 border-t border-[var(--line)] px-6 pb-10 pt-8"
    >
      <div className="flex items-center gap-9">
        <a
          href="https://harrythehirer.com.au"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Harry the Hirer"
          className="inline-flex items-center opacity-70 transition hover:-translate-y-px hover:opacity-100"
        >
          <Image
            src="/brand/hth-logo.png"
            alt="Harry the Hirer"
            width={120}
            height={26}
            className="h-[26px] w-auto"
            priority={false}
          />
        </a>
        <a
          href="https://relook.hthsystems.com.au"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Relook"
          className="inline-flex items-center opacity-70 transition hover:-translate-y-px hover:opacity-100"
        >
          <Image
            src="/brand/relook-logo.png"
            alt="Relook"
            width={140}
            height={30}
            className="h-[30px] w-auto"
            priority={false}
          />
        </a>
      </div>
      <p
        className="signature-shimmer text-[11px] italic tracking-wide"
        style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
        aria-label="Engineered by Simone Leonelli"
      >
        Engineered by{" "}
        <span className="signature-name">Simone Leonelli</span>
      </p>
    </footer>
  );
}
