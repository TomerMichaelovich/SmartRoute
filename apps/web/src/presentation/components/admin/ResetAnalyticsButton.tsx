"use client";

interface ResetAnalyticsButtonProps {
  storeName: string;
  resetAnalytics: () => Promise<void>;
  className?: string;
}

export function ResetAnalyticsButton({ storeName, resetAnalytics, className = "" }: ResetAnalyticsButtonProps) {
  return (
    <form
      action={resetAnalytics}
      onSubmit={(e) => {
        if (
          !confirm(`לאפס לצמיתות את כל נתוני האנליטיקס של הסניף "${storeName}"? הפעולה בלתי הפיכה.`)
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className={`text-red-600 hover:underline ${className}`}>
        אפס אנליטיקס לסניף זה
      </button>
    </form>
  );
}
