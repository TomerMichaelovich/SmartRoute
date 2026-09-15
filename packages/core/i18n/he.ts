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
    register: "הרשמה",
    login: "התחברות לחשבון קיים",
    continueAsGuest: "המשך כאורח",
    loggedInAs(name: string): string {
      return `מחוברים כ${name}`;
    },
    myAccount: "החשבון שלי",
  },
  auth: {
    register: {
      title: "הרשמה ל־NAVIO",
      subtitle: "חשבון מאפשר לשמור רשימות, לגשת אליהן מכל מכשיר ולשתף עם בני הבית",
      nameLabel: "שם",
      namePlaceholder: "איך לקרוא לך?",
      emailLabel: "אימייל",
      passwordLabel: "סיסמה",
      passwordHint: "לפחות 8 תווים",
      submit: "יצירת חשבון",
      haveAccount: "כבר יש לכם חשבון?",
      goToLogin: "התחברו",
    },
    login: {
      title: "התחברות",
      subtitle: "התחברו כדי לגשת לרשימות ולהיסטוריית הקניות שלכם",
      emailLabel: "אימייל",
      passwordLabel: "סיסמה",
      submit: "התחברות",
      noAccount: "אין לכם חשבון עדיין?",
      goToRegister: "הרשמו",
      forgotPassword: "שכחתם סיסמה?",
      forgotPasswordHelp:
        "שחזור סיסמה עצמאי עדיין לא זמין בגרסת הפיילוט. אם נרשמתם עם Google, התחברו דרך Google. אחרת, פנו אלינו.",
    },
    google: {
      continueWith: "המשך עם Google",
      or: "או",
    },
    errors: {
      emailRequired: "יש להזין אימייל",
      emailInvalid: "כתובת אימייל לא תקינה",
      emailTaken: "כבר קיים חשבון עם האימייל הזה",
      nameRequired: "יש להזין שם",
      passwordRequired: "יש להזין סיסמה",
      passwordTooShort: "הסיסמה חייבת לכלול לפחות 8 תווים",
      invalidCredentials: "אימייל או סיסמה שגויים",
      googleFailed: "ההתחברות עם Google נכשלה. נסו שוב.",
    },
  },
  account: {
    title: "החשבון שלי",
    emailLabel: "אימייל",
    nameLabel: "שם",
    logout: "התנתקות",
    loggingOut: "מתנתק...",
  },
  household: {
    title: "הבית שלי",
    subtitle: "בית משותף מאפשר לכל בני הבית לערוך יחד רשימת קניות אחת",
    none: {
      title: "עדיין אין לך בית משותף",
      body: "צור בית והזמן אליו את בני המשפחה, או הצטרף לבית קיים דרך קישור הזמנה.",
      createLabel: "שם הבית",
      createPlaceholder: "לדוגמה: משפחת כהן",
      createButton: "יצירת בית",
    },
    pending: {
      title: "הבקשה שלך ממתינה לאישור",
      body(name: string): string {
        return `ביקשת להצטרף ל"${name}". חבר קיים בבית צריך לאשר את הבקשה.`;
      },
      cancel: "ביטול הבקשה",
    },
    members: {
      heading: "חברי הבית",
      you: "את/ה",
      owner: "מנהל/ת",
      pendingBadge: "ממתין לאישור",
      approve: "אישור",
      remove: "הסרה",
      removeConfirm: "להסיר את החבר מהבית? הגישה שלו לרשימה המשותפת תיפסק מיד.",
    },
    invite: {
      heading: "הזמנת בני בית",
      generate: "צור קישור הזמנה",
      linkLabel: "שלח את הקישור הזה למי שתרצה לצרף:",
      copy: "העתקת קישור",
      copied: "הועתק!",
      revoke: "ביטול קישור",
      expiresNote: "הקישור תקף ל־7 ימים. מי שנכנס דרכו ימתין לאישורך.",
    },
    leave: "יציאה מהבית",
    leaveConfirm: "לצאת מהבית המשותף?",
    ownerCantLeave: "בתור מנהל/ת, עליך להסיר תחילה את שאר החברים או להעביר ניהול.",
    join: {
      title: "הצטרפות לבית",
      prompt(name: string): string {
        return `הוזמנת להצטרף ל"${name}". לאחר האישור של חבר קיים בבית, תוכל לערוך את הרשימה המשותפת.`;
      },
      confirm: "בקש להצטרף",
      invalid: "קישור ההזמנה אינו תקין או שפג תוקפו.",
      alreadyMember: "את/ה כבר חבר/ה בבית הזה.",
      alreadyInOther: "את/ה כבר משתייך/ת לבית אחר. צא/י ממנו כדי להצטרף לבית חדש.",
      requested: "הבקשה נשלחה. נעדכן אותך כשהיא תאושר.",
    },
    sharedList: {
      badge: "רשימת הבית",
      heading: "רשימת הבית המשותפת",
      subtitle: "כל בני הבית עורכים את הרשימה הזו יחד. שינויים של אחרים מתעדכנים אוטומטית.",
      createButton: "צור רשימת בית משותפת",
      createHint: "בחר סניף לרשימה המשותפת של הבית",
      openButton: "פתח את רשימת הבית",
      addPlaceholder: "הוסיפו פריטים, אחד בכל שורה",
      addButton: "הוספה לרשימה",
      empty: "הרשימה ריקה. הוסיפו את הפריט הראשון.",
      remove: "הסרה",
      collected(n: number, total: number): string {
        return `${n} מתוך ${total} נאספו`;
      },
      collectedBy(name: string): string {
        return `נאסף ע"י ${name}`;
      },
      syncing: "מסתנכרן...",
      updatedByOthers: "הרשימה עודכנה",
    },
  },
  history: {
    title: "היסטוריית קניות",
    subtitle: "כל קנייה שסיימת נשמרת כאן, בדיוק כפי שהייתה",
    empty: "עדיין לא סיימת אף קנייה",
    open: "פרטי הקנייה",
    collectedCount(collected: number, total: number): string {
      return `${collected} מתוך ${total} נאספו`;
    },
    detailTitle: "פרטי הקנייה",
    dateLabel: "תאריך",
    storeLabel: "סניף",
    itemsHeading: "פריטים ברשימה",
    collected: "נאסף",
    notCollected: "לא נאסף",
    notFound: "לא נמצא בסניף",
    repeat: "רשימה חדשה מקנייה זו",
    repeatCreating: "יוצר רשימה...",
    notMine: "הקנייה הזו לא שייכת לחשבון שלך",
  },
  myList: {
    widgetTitle: "הרשימה שלי",
    openList: "פתחו את הרשימה",
    haveCode: "יש לכם קוד שיתוף?",
    defaultName(storeName?: string): string {
      return storeName ? `רשימה – ${storeName}` : "רשימת קניות";
    },
    untitled: "רשימה ללא שם",
    manage: {
      title: "הרשימות שלי",
      subtitle: "הרשימות שלכם נשמרות בחשבון וזמינות מכל מכשיר",
      empty: "עדיין אין לכם רשימות שמורות",
      active: "פעילה",
      makeActive: "הפוך לפעילה",
      rename: "שינוי שם",
      renamePrompt: "שם חדש לרשימה",
      delete: "מחיקה",
      deleteConfirm: "למחוק את הרשימה? אפשר יהיה לשחזר רק דרך פנייה אלינו.",
      newList: "רשימה חדשה",
      open: "פתיחה",
      itemCount(n: number): string {
        if (n === 0) return "רשימה ריקה";
        if (n === 1) return "פריט אחד";
        if (n === 2) return "שני פריטים";
        return `${n} פריטים`;
      },
    },
    claim: {
      claimedTitle: "הרשימה נשמרה לחשבון שלך",
      claimedBody: "הרשימה שיצרת כאורח מחוברת עכשיו לחשבון וזמינה מכל מכשיר.",
      conflictTitle: "כבר יש רשימה בחשבון שלך",
      conflictBody:
        "יצרת רשימה כאורח, ובחשבון שאליו התחברת כבר קיימת רשימה. מה לעשות?",
      keepExisting: "המשך עם הרשימה הקיימת",
      keepExistingHint: "רשימת האורח לא תיווסף לחשבון (עדיין אפשר לפתוח אותה עם קוד השיתוף).",
      newEmpty: "התחל רשימה חדשה וריקה",
      newEmptyHint: "הרשימה הקיימת נשמרת, ורשימת האורח לא תיווסף.",
      dismiss: "הבנתי",
    },
    codePlaceholder: "הקלידו קוד",
    openByCode: "פתחו",
    codeNotFound: "לא מצאנו רשימה עם הקוד הזה",
    itemCount(n: number): string {
      if (n === 0) return "אין פריטים ברשימה";
      if (n === 1) return "פריט אחד";
      if (n === 2) return "שני פריטים";
      return `${n} פריטים`;
    },
    share: {
      button: "שתפו עם בני הבית",
      copied: "הקישור הועתק!",
      codeLabel(code: string): string {
        return `קוד לשיתוף: ${code}`;
      },
    },
    editor: {
      title: "הרשימה שלי",
      subtitle: "אפשר לערוך את הרשימה בכל שלב, גם כמה ימים לפני שיוצאים לקניות",
      addItemsPlaceholder: "הוסיפו פריטים, אחד בכל שורה",
      addItems: "הוסיפו לרשימה",
      removeItem: "הסירו פריט",
      save: "שמרו שינויים",
      saved: "נשמר",
      staleTitle: "הרשימה עודכנה בינתיים על ידי מישהו אחר",
      loadLatest: "טענו את הגרסה העדכנית",
      saveAnyway: "שמרו בכל זאת",
    },
    notFound: {
      title: "קוד לא תקין",
      subtitle: "הקישור שגוי או שהרשימה כבר לא קיימת",
      backHome: "חזרה למסך הבית",
    },
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
