export const he = {
  common: {
    appName: "NAVIO",
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
    chooseMethod: {
      title: "איך תעלו את רשימת הקניות?",
      subtitle: "בחרו את הדרך הנוחה לכם",
      manualTitle: "רשימה ידנית",
      manualDescription: "הקלידו או הדביקו את הרשימה",
      photoTitle: "צילום רשימה",
      photoDescription: "צלמו או העלו תמונה של הרשימה",
    },
    photo: {
      title: "צילום רשימת קניות",
      subtitle: "צלמו את הרשימה או העלו תמונה קיימת, ואנחנו ננסה לזהות את הפריטים",
      pickImage: "בחרו תמונה",
      retake: "בחרו תמונה אחרת",
      recognizeButton: "זהו טקסט מהתמונה",
      recognizing: "מזהים טקסט בתמונה...",
      recognizeError: "לא הצלחנו לזהות טקסט בתמונה. נסו תמונה ברורה יותר או עברו לרשימה ידנית.",
      reviewHint: "בדקו ותקנו את הפריטים שזיהינו לפני שממשיכים",
    },
  },
  review: {
    title: "בדיקת הפריטים",
    subtitle: "בדקו שזיהינו נכון את הפריטים שלכם, ותקנו אם צריך",
    notFound: "לא נמצא",
    outOfStock: "לא במלאי בסניף זה",
    checkThis: "כדאי לבדוק",
    chooseProduct: "בחרו מוצר",
    suggestionsLabel: "האם התכוונתם ל...",
    showFullList: "בחירה מרשימה מלאה",
    noMatch: "— לא נבחר —",
    continueToRoute: "המשך למסלול הקנייה",
    missingEntranceOrCheckout:
      "לא ניתן לבנות מסלול: לסניף הזה חסרה נקודת כניסה ו/או קופה במפה. פנו למנהל הסניף להשלמת ההגדרה.",
    disconnectedGraph:
      "לא ניתן לבנות מסלול: חסרים קשרים (קשתות) במפת הסניף בין חלק מהנקודות. פנו למנהל הסניף להשלמת ההגדרה.",
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
      // Covers two different reasons (not identified, or identified but out of stock at
      // this store) - kept generic since the count alone can't distinguish which applied.
      return n === 1
        ? "פריט אחד לא נכלל במסלול"
        : `${n} פריטים לא נכללו במסלול`;
    },
    finishShopping: "סיימתי לקנות",
    notFoundButton: "לא מצאתי",
    notFoundMarked: "דיווחתם שלא נמצא",
  },
  promotions: {
    sponsored: "ממומן",
  },
  summary: {
    title: "סיכום הקנייה",
    subtitle: "כל הכבוד! סיימתם לקנות",
    duration: "משך הקנייה",
    distance: "מרחק הליכה",
    backtracks: "חזרות אחורה במסלול",
    satisfactionQuestion: "איך הייתה חוויית הקנייה?",
    satisfactionThanks: "תודה על המשוב!",
    startNewRoute: "קנייה חדשה",
    minutesShort(n: number): string {
      return `${n} דק׳`;
    },
    secondsShort(n: number): string {
      return `${n} שנ׳`;
    },
  },
} as const;
