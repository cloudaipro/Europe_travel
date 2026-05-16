// Strip ```json ... ``` fences from LLM output.
// Ports server/app/planner.py :: _strip_code_fence.

export function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    const nl = t.indexOf("\n");
    t = nl >= 0 ? t.slice(nl + 1) : t.slice(3);
    if (t.endsWith("```")) {
      const last = t.lastIndexOf("```");
      t = t.slice(0, last);
    }
  }
  return t.trim();
}
