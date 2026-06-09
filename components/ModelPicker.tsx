"use client";

import { Bolt, Boxes, Gem } from "lucide-react";
import { MODELS } from "@/lib/fal";
import type { FalModelId } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: FalModelId;
  onChange: (id: FalModelId) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Card
        active={value === "fal-ai/reconviagen-0.5"}
        onClick={() => onChange("fal-ai/reconviagen-0.5")}
        disabled={disabled}
        icon={<Boxes className="h-4 w-4" />}
        info={MODELS["fal-ai/reconviagen-0.5"]}
        priceLabel="Est. · metered"
      />
      <Card
        active={value === "tripo3d/p1/image-to-3d"}
        onClick={() => onChange("tripo3d/p1/image-to-3d")}
        disabled={disabled}
        icon={<Bolt className="h-4 w-4" />}
        info={MODELS["tripo3d/p1/image-to-3d"]}
        priceLabel="$0.40 – $0.50"
      />
      <Card
        active={value === "tripo3d/h3.1/multiview-to-3d"}
        onClick={() => onChange("tripo3d/h3.1/multiview-to-3d")}
        disabled={disabled}
        icon={<Gem className="h-4 w-4" />}
        info={MODELS["tripo3d/h3.1/multiview-to-3d"]}
        priceLabel="$0.10 – $0.55"
        className="sm:col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function Card({
  active,
  onClick,
  disabled,
  icon,
  info,
  priceLabel,
  className,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  info: { tagline: string; description: string };
  priceLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border bg-background/40 p-4 text-left backdrop-blur transition",
        active
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {priceLabel}
        </span>
      </div>
      <div className="space-y-1.5">
        <h3 className="font-sans text-sm font-semibold leading-snug tracking-tight text-foreground">
          {info.tagline}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {info.description}
        </p>
      </div>
    </button>
  );
}
