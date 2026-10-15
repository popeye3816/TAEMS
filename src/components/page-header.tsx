import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ComingSoon({ milestone, items }: { milestone: string; items: string[] }) {
  return (
    <div className="card p-6">
      <p className="text-sm font-medium text-slate-700">{milestone}에서 구현 예정</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ContentSkeleton() {
  return <div className="card h-40 animate-pulse bg-slate-100" aria-hidden />;
}
