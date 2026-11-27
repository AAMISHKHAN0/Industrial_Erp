"use client";

interface Creator {
  id: string;
  email: string;
  role?: string;
  roleNames?: string[];
}

interface Props {
  creator: Creator | null | undefined;
}

function initials(email: string): string {
  const local = email.split("@")[0];
  if (!local) return "?";
  const parts = local.split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function roleLabel(creator: Creator): string {
  if (creator.roleNames && creator.roleNames.length > 0) return creator.roleNames.join(", ");
  if (creator.role) return creator.role;
  return "";
}

export function CreatedByCell({ creator }: Props) {
  if (!creator) return <span className="text-sm text-muted-foreground">—</span>;
  const role = roleLabel(creator);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-mono text-xs font-medium text-foreground"
        title={creator.email}
      >
        {initials(creator.email)}
      </div>
      <div className="min-w-0">
        <div className="max-w-[160px] truncate text-sm text-foreground" title={creator.email}>
          {creator.email}
        </div>
        {role && (
          <div className="max-w-[160px] truncate text-xs leading-tight text-muted-foreground" title={role}>
            {role}
          </div>
        )}
      </div>
    </div>
  );
}
