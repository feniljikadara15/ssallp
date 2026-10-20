// Usage: npm run hash-password -- you@example.com 'secret'
// Prints an APP_USERS entry with a hashed password.
import { randomBytes, scryptSync } from "node:crypto";
const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error("Usage: npm run hash-password -- <email> <password>"); process.exit(1); }
const salt = randomBytes(16).toString("base64url");
console.log(`${email}:scrypt$${salt}$${scryptSync(password, salt, 32).toString("base64url")}`);
