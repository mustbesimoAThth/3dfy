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
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
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
        active={value === "tripo3d/h3.1/image-to-3d"}
        onClick={() => onChange("tripo3d/h3.1/image-to-3d")}
        disabled={disabled}
        icon={<Gem className="h-4 w-4" />}
        info={MODELS["tripo3d/h3.1/image-to-3d"]}
        priceLabel="$0.20 – $0.95"
        className="sm:col-span-2 xl:col-span-1"
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
  info: { name: string; tagline: string; description: string };
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
        "rounded-2xl border bg-background/40 p-4 text-left backdrop-blur transition",
        active
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 font-medium">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
          <span className="truncate">{info.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
          {priceLabel}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-primary">{info.tagline}</p>
      <p className="mt-1 text-xs text-muted-foreground">{info.description}</p>
    </button>
  );
}
