import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// 접속정보(IP·계정·비밀번호) 암호화. 형식: v1:<iv>:<tag>:<암호문> (모두 base64)
// scripts/import/load.mjs에도 같은 형식의 암호화 코드가 있다. 바꿀 때 함께 바꾼다.
const VERSION = "v1";

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY 환경변수가 없습니다.");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY는 32바이트(base64)여야 합니다.");
  return buf;
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("알 수 없는 암호문 형식입니다.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
