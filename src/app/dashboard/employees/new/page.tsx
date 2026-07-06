import { redirect } from "next/navigation";

/**
 * The single-form create page has been superseded by the guided Hiring Studio
 * (Prompt 004). Keep this route as a permanent redirect so existing links and
 * bookmarks continue to work.
 */
export default function NewEmployeeRedirect() {
  redirect("/dashboard/hire");
}
