export const he = {
  common: {
    appName: "SmartRoute",
    back: "חזרה",
    continue: "המשך",
    loading: "טוען...",
    error: "משהו השתבש. נסו שוב.",
  },
  home: {
    heroSubtitle: "תכננו את מסלול הקנייה שלכם מראש, חסכו זמן והליכה מיותרת",
    tagline: "קונים חכם. הולכים פחות. קונים מה שתכננתם.",
    startShopping: "התחילו לקנות",
  },
  branches: {
    title: "בחרו סניף",
    subtitle: "לאיזה סניף אתם הולכים היום?",
    selectBranch: "בחרו סניף זה",
    noBranches: "אין כרגע סניפים זמינים",
  },
  list: {
    title: "רשימת קניות",
    subtitle: "הדביקו או הקלידו את רשימת הקניות שלכם, פריט בכל שורה",
    placeholder: "לדוגמה:\nחלב\nלחם\nעגבניות",
    continueToReview: "המשך לבדיקת הפריטים",
    itemCount(n: number): string {
      if (n === 0) return "אין פריטים ברשימה";
      if (n === 1) return "פריט אחד ברשימה";
      if (n === 2) return "שני פריטים ברשימה";
      return `${n} פריטים ברשימה`;
    },
  },
  review: {
    title: "בדיקת הפריטים",
    subtitle: "בדקו שזיהינו נכון את הפריטים שלכם, ותקנו אם צריך",
    notFound: "לא נמצא",
    checkThis: "כדאי לבדוק",
    chooseProduct: "בחרו מוצר",
    noMatch: "— לא נבחר —",
    continueToRoute: "המשך למסלול הקנייה",
    unresolvedWarning(n: number): string {
      return n === 1
        ? "פריט אחד לא זוהה ולא ייכלל במסלול"
        : `${n} פריטים לא זוהו ולא ייכללו במסלול`;
    },
  },
  route: {
    progress(checked: number, total: number): string {
      if (total === 0) return "אין פריטים למסלול הזה";
      return `${checked} מתוך ${total} פריטים נאספו`;
    },
    unresolvedNotice(n: number): string {
      return n === 1
        ? "פריט אחד לא נכלל במסלול כי לא זוהה"
        : `${n} פריטים לא נכללו במסלול כי לא זוהו`;
    },
    finishShopping: "סיימתי לקנות",
  },
  promotions: {
    sponsored: "ממומן",
  },
} as const;
