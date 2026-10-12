import { isAuthed } from "@/lib/auth";
import { StaffApp } from "@/components/staff/staff-app";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const authed = await isAuthed();
  return <StaffApp initialAuthed={authed} />;
}
