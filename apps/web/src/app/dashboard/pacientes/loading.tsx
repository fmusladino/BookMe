import { TableSkeleton } from "@/components/shared/page-skeleton";

export default function PacientesLoading() {
  return <TableSkeleton cols={5} rows={8} />;
}
