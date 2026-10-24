"use client";

interface DeleteAdminUserButtonProps {
  displayName: string;
  deleteAdminUser: () => Promise<void>;
}

export function DeleteAdminUserButton({ displayName, deleteAdminUser }: DeleteAdminUserButtonProps) {
  return (
    <form
      action={deleteAdminUser}
      onSubmit={(e) => {
        if (!confirm(`למחוק את משתמש הניהול "${displayName}"? הוא ינותק ולא יוכל להיכנס יותר.`)) e.preventDefault();
      }}
    >
      <button type="submit" className="text-red-600 hover:underline">
        מחק משתמש
      </button>
    </form>
  );
}
