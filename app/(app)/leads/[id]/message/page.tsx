import { redirect } from "next/navigation";

// Drafting now happens inline on the lead detail page. Keep this URL working
// for bookmarks, email links and external references.
export default function LeadMessagePage({ params }: { params: { id: string } }) {
  redirect(`/leads/${params.id}#email-outreach`);
}
