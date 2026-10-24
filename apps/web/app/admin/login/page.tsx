import { login } from "@/src/presentation/actions/admin-auth-actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-5 py-8">
      <h1 className="text-xl font-bold text-neutral-900">כניסה לניהול</h1>
      <form action={login} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <input
          name="username"
          placeholder="שם משתמש"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          dir="ltr"
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          type="password"
          name="password"
          placeholder="סיסמה"
          autoComplete="current-password"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <p className="text-xs text-neutral-500">כניסת בעלים: השאירו את שם המשתמש ריק.</p>
        {error && <p className="text-sm text-red-600">שם משתמש או סיסמה שגויים</p>}
        <button
          type="submit"
          className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
        >
          כניסה
        </button>
      </form>
    </div>
  );
}
