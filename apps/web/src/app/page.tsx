import { HomeCockpit } from "./HomeCockpit";
import { runDemoAssessment } from "../lib/demo/assessment";

// Assessment is a deterministic computation over the preview profile —
// safe to run at request time on the server and pass down as props.
const assessment = runDemoAssessment();

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <HomeCockpit assessment={assessment} />
    </main>
  );
}
