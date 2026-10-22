/**
 * What the child sees when the chat model declines a turn (Claude API
 * stop_reason "refusal"). Kept outside the provider so the conversation
 * service can recognise a declined turn without importing provider code.
 */
export const REFUSAL_FALLBACK_TEXT =
  "그 이야기는 내가 도와주기 어려운 내용이야. 대신 다른 이야기를 같이 해 볼까? 혹시 마음이 힘들거나 무서운 일이 있으면 보호자나 간호사 선생님께 꼭 말해 줘.";

/**
 * True when a companion reply ends with the refusal text. A declined turn is
 * kept out of the model's future context: sent again, it would make the next
 * turns decline too.
 */
export function isRefusalReply(text: string): boolean {
  return text.trimEnd().endsWith(REFUSAL_FALLBACK_TEXT);
}
