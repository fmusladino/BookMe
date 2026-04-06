import { redirect } from "next/navigation";

// El dashboard principal redirige a la agenda
export default function DashboardPage() {
  redirect("/dashboard/agenda");
}
