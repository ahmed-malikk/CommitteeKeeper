export const MEMBER_NAME_MAX = 60;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 30;

export type MemberInput = { name: string; email: string; phone: string };
export type MemberProblems = Partial<Record<keyof MemberInput | "slots", string>>;

// One "@", something before it, a dot-separated domain after it, and no spaces. Deliberately simple:
// the only real proof an email works is sending to it.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with the usual separators: +92 300 1234567, (042) 111-222-333.
const PHONE = /^\+?[\d\s\-()]{6,}$/;

/** Checks a member's details. Email and phone are optional, but if given they must look right. */
export function validateMember(input: MemberInput): { clean: MemberInput | null; problems: MemberProblems } {
  const problems: MemberProblems = {};
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (name === "") problems.name = "Enter the member's name.";
  else if ([...name].length > MEMBER_NAME_MAX) problems.name = `Keep the name to ${MEMBER_NAME_MAX} characters or fewer.`;

  if (email !== "") {
    if (email.length > EMAIL_MAX || !EMAIL.test(email)) problems.email = "That email address doesn't look right. Leave it empty if you don't have one.";
  }
  if (phone !== "") {
    if (phone.length > PHONE_MAX || !PHONE.test(phone) || phone.replace(/\D/g, "").length < 6) problems.phone = "Use digits only, like 0300 1234567 or +92 300 1234567.";
  }

  if (Object.keys(problems).length > 0) return { clean: null, problems };
  return { clean: { name, email, phone }, problems };
}

/** How many slots to give a new member: a whole number from 1 up to the room left in the committee. */
export function validateSlotCount(text: string, room: number): string | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t) || Number(t) < 1) return "Give the member at least 1 slot.";
  if (Number(t) > room) {
    return room <= 0 ? "Every slot is already taken. Remove a slot before adding another." : `Only ${room} slot${room === 1 ? " is" : "s are"} left in this committee.`;
  }
  return null;
}
