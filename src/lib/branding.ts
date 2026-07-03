/**
 * Factory branding — single source of truth.
 *
 * All chrome (sidebar, header, page metadata, error page, invite page),
 * invoice PDF template, and Excel exporters import from here. Editing this
 * file changes every branded surface at once.
 *
 * Auth screens (login, forgot-password) are intentionally NOT rebranded and
 * do not import from this file. They stay as "FactoryFlow" per user request.
 */

/** Full company name — used wherever space allows. */
export const COMPANY_NAME_AR_FULL = "جبال الشام للحجر والرخام";

/** Short company name — used in the sidebar and per-page metadata titles where space is tight. */
export const COMPANY_NAME_AR_SHORT = "جبال الشام";

/** Software subtitle — displayed under the company name in the sidebar. */
export const COMPANY_SUBTITLE_AR = "نظام إدارة المصنع";

/** Description — used in the root metadata + Open Graph + Twitter card. */
export const COMPANY_DESCRIPTION_AR = "نظام متكامل لإدارة العمليات المالية والمخزون";

/** 512×512 master logo — used by the sidebar (Next.js Image auto-optimizes on request). */
export const LOGO_PATH = "/logo.png";

/** 192×192 downscaled copy — used by the favicon and the invoice PDF header (small file, no auto-optimization there). */
export const LOGO_PATH_SMALL = "/logo-192.png";
