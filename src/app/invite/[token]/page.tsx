import InvitationClient from "./InvitationClient";

// Provide a placeholder static param so Next.js can export this route.
// In the local Electron app this page is never reachable (no Firebase
// invites in local mode); in the web app the real token is read at runtime.
export async function generateStaticParams() {
  return [{ token: "placeholder" }];
}
export const dynamicParams = true;

export default function InvitationPage() {
  return <InvitationClient />;
}
