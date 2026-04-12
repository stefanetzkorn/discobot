// Bun.sql reads DATABASE_URL from the environment automatically.
// Export it so events and commands can import it directly.
export const sql = Bun.sql;
