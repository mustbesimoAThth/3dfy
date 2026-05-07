"use client";

import type { H31Options, P1Options } from "@/lib/fal";
import type { FalModelId } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export type Options =
  | { model: "tripo3d/p1/image-to-3d"; options: P1Options }
  | { model: "tripo3d/h3.1/image-to-3d"; options: H31Options };

export function GenerationOptions({
  model,
  p1,
  h31,
  onChangeP1,
  onChangeH31,
  disabled,
}: {
  model: FalModelId;
  p1: P1Options;
  h31: H31Options;
  onChangeP1: (next: P1Options) => void;
  onChangeH31: (next: H31Options) => void;
  disabled?: boolean;
}) {
  if (model === "tripo3d/p1/image-to-3d") {
    return (
      <div className="space-y-2">
        <Toggle
          label="Generate textures"
          help="Adds a PBR texture pass (+$0.10)."
          checked={p1.texture}
          onChange={(v) => onChangeP1({ ...p1, texture: v })}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Texture quality
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(["no", "standard", "HD"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => onChangeH31({ ...h31, texture: t })}
              className={cn(
                "rounded-xl border bg-background/40 px-3 py-2 text-xs font-medium capitalize backdrop-blur transition",
                h31.texture === t
                  ? "border-primary text-primary ring-2 ring-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {t === "no" ? "No textures" : t}
              <span className="ml-1 text-[10px] opacity-70">
                {t === "no" ? "" : t === "HD" ? "+$0.20" : "+$0.10"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Toggle
        label="Detailed geometry"
        help="Higher polygon count, finer details (+$0.20)."
        checked={h31.detailed_geometry}
        onChange={(v) => onChangeH31({ ...h31, detailed_geometry: v })}
        disabled={disabled}
      />
      <Toggle
        label="Quad mesh"
        help="Output a clean quad topology, better for animation (+$0.05)."
        checked={h31.quad}
        onChange={(v) => onChangeH31({ ...h31, quad: v })}
        disabled={disabled}
      />
      <Toggle
        label="PBR materials"
        help="Include physically-based materials (no extra cost)."
        checked={h31.pbr}
        onChange={(v) => onChangeH31({ ...h31, pbr: v })}
        disabled={disabled}
      />
    </div>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 backdrop-blur",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help && (
          <span className="block text-[11px] text-muted-foreground">{help}</span>
        )}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          checked ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 translate-x-0.5 transform rounded-full bg-background shadow transition",
            checked && "translate-x-[22px]",
          )}
        />
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </label>
  );
}
