import { EvergreenHubPage, hubMetadata } from "@/components/evergreen-hub-page";
export const metadata = hubMetadata("release-date");
export default function Page() { return <EvergreenHubPage hubKey="release-date" />; }
