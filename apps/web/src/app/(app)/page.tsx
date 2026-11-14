import { Suspense } from "react";
import { Chat } from "@/components/chat";
import { env } from "@/lib/server";

/** Home: a plain conversation with the Chief. Everything else is one tap away in the sidebar. */
export default function Home() {
  const e = env();
  const simulation = !(e.ANTHROPIC_API_KEY && (e.OPENAI_API_KEY || e.DEEPSEEK_API_KEY));
  return (
    <Suspense>
      <Chat simulation={simulation} />
    </Suspense>
  );
}
