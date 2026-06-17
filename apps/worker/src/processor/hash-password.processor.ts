import bcrypt from "bcrypt";

export default async function hashPassword(text: string) {
  return bcrypt.hash(text, 10);
}
