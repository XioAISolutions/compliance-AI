import { redirect } from "next/navigation";

// The demo cockpit has been folded into the unified home cockpit at `/`.
// Existing links (marketing, docs, bookmarks) redirect rather than 404.
export default function DemoRedirect() {
  redirect("/");
}
