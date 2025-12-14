/**
 * Payment Categories Configuration
 *
 * Categories with subcategories matching ledger categories
 */

export interface PaymentCategory {
  name: string;
  type: "دخل" | "مصروف";
  subcategories: string[];
}

export const PAYMENT_CATEGORIES: PaymentCategory[] = [
  // Income Categories
  {
    name: "إيرادات المبيعات",
    type: "دخل",
    subcategories: ["مبيعات منتجات", "خدمات", "استشارات", "عمولات"]
  },
  {
    name: "رأس المال",
    type: "دخل",
    subcategories: ["رأس مال مالك", "سحوبات المالك"]
  },
  {
    name: "إيرادات أخرى",
    type: "دخل",
    subcategories: ["فوائد بنكية", "بيع أصول", "إيرادات متنوعة"]
  },
  // Expense Categories
  {
    name: "تكلفة البضاعة المباعة (COGS)",
    type: "مصروف",
    subcategories: ["مواد خام", "شحن", "شراء بضاعة جاهزة"]
  },
  {
    name: "مصاريف تشغيلية",
    type: "مصروف",
    subcategories: [
      "رواتب وأجور", "إيجارات", "كهرباء وماء", "صيانة",
      "وقود ومواصلات", "رحلة عمل", "نقل بضاعة", "تسويق وإعلان",
      "مصاريف إدارية", "اتصالات وإنترنت", "مصاريف مكتبية"
    ]
  },
  {
    name: "أصول ثابتة",
    type: "مصروف",
    subcategories: [
      "معدات وآلات", "أثاث ومفروشات", "سيارات ومركبات",
      "مباني وعقارات", "أجهزة كمبيوتر"
    ]
  },
  {
    name: "التزامات مالية",
    type: "مصروف",
    subcategories: ["سداد قروض", "فوائد قروض", "ضرائب ورسوم"]
  },
  {
    name: "مصاريف أخرى",
    type: "مصروف",
    subcategories: ["مصاريف قانونية", "تأمينات", "مصاريف متنوعة"]
  },
];
