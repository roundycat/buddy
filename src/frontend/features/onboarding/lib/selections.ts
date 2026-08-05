/**
 * Onboarding survey helpers — keep payload building out of JSX when possible.
 */

export const OTHER_LABEL = "기타";

export function joinSelections(selected: string[], otherText: string): string {
  const chips = selected.filter((item) => item !== OTHER_LABEL);
  const extra = selected.includes(OTHER_LABEL) ? otherText.trim() : "";
  return [...chips, ...(extra ? [extra] : [])].join(", ");
}

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}
