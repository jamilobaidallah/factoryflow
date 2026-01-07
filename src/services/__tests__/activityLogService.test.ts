/**
 * Activity Log Service Tests
 *
 * Tests for activity logging functionality including creating logs
 * and querying recent activities.
 */

import { logActivity, getRecentActivities } from "../activityLogService";
import type { ActivityLogInput, ActivityLog, ActivityModule, ActivityAction } from "@/types/activity-log";

// Track mock calls
let mockAddDocResult: Promise<any> = Promise.resolve({ id: "mock-log-id" });
let mockGetDocsResult: any[] = [];

// Mock firebase/firestore
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((db, path) => ({ _path: path, _collection: true })),
  addDoc: jest.fn(() => mockAddDocResult),
  getDocs: jest.fn(() =>
    Promise.resolve({
      docs: mockGetDocsResult.map((data, index) => ({
        id: `log-${index}`,
        data: () => data,
      })),
    })
  ),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  where: jest.fn((field, op, value) => ({ type: "where", field, op, value })),
  orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
  limit: jest.fn((count) => ({ type: "limit", count })),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date("2024-01-15T12:00:00Z") })),
  },
}));

// Mock firebase config
jest.mock("@/firebase/config", () => ({
  firestore: { _mock: "firestore" },
}));

describe("Activity Log Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDocResult = Promise.resolve({ id: "mock-log-id" });
    mockGetDocsResult = [];
  });

  describe("logActivity", () => {
    const createActivityInput = (overrides: Partial<ActivityLogInput> = {}): ActivityLogInput => ({
      userId: "user-123",
      userEmail: "user@example.com",
      userDisplayName: "مستخدم اختبار",
      action: "create",
      module: "ledger",
      description: "إنشاء قيد جديد",
      ...overrides,
    });

    it("should log activity to correct collection path", () => {
      const { collection } = require("firebase/firestore");
      const input = createActivityInput();

      logActivity("owner-456", input);

      expect(collection).toHaveBeenCalledWith(
        expect.anything(), // firestore
        "users/owner-456/activity_logs"
      );
    });

    it("should add document with all input fields", () => {
      const { addDoc, Timestamp } = require("firebase/firestore");
      const input = createActivityInput({
        targetId: "target-789",
        metadata: { amount: 1000, category: "مبيعات" },
      });

      logActivity("owner-456", input);

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(), // collection ref
        expect.objectContaining({
          userId: "user-123",
          userEmail: "user@example.com",
          userDisplayName: "مستخدم اختبار",
          action: "create",
          module: "ledger",
          description: "إنشاء قيد جديد",
          targetId: "target-789",
          metadata: { amount: 1000, category: "مبيعات" },
          createdAt: expect.anything(),
        })
      );

      expect(Timestamp.now).toHaveBeenCalled();
    });

    it("should handle all activity actions", () => {
      const { addDoc } = require("firebase/firestore");
      const actions: ActivityAction[] = [
        "create",
        "update",
        "delete",
        "approve",
        "reject",
        "role_change",
        "remove_access",
        "write_off",
      ];

      actions.forEach((action) => {
        logActivity("owner-456", createActivityInput({ action }));
      });

      expect(addDoc).toHaveBeenCalledTimes(actions.length);
    });

    it("should handle all activity modules", () => {
      const { addDoc } = require("firebase/firestore");
      const modules: ActivityModule[] = [
        "ledger",
        "partners",
        "clients",
        "payments",
        "cheques",
        "inventory",
        "fixed_assets",
        "production",
        "employees",
        "invoices",
        "users",
      ];

      modules.forEach((module) => {
        logActivity("owner-456", createActivityInput({ module }));
      });

      expect(addDoc).toHaveBeenCalledTimes(modules.length);
    });

    it("should not throw on addDoc failure (fire-and-forget)", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAddDocResult = Promise.reject(new Error("Network error"));

      // Should not throw
      expect(() => logActivity("owner-456", createActivityInput())).not.toThrow();

      consoleSpy.mockRestore();
    });

    it("should log error on failure", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const error = new Error("Permission denied");
      mockAddDocResult = Promise.reject(error);

      logActivity("owner-456", createActivityInput());

      // Wait for promise rejection to be handled
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith("Error logging activity:", error);

      consoleSpy.mockRestore();
    });

    it("should handle activity without optional fields", () => {
      const { addDoc } = require("firebase/firestore");
      const input: ActivityLogInput = {
        userId: "user-123",
        userEmail: "user@example.com",
        action: "delete",
        module: "clients",
        description: "حذف عميل",
      };

      logActivity("owner-456", input);

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: "user-123",
          action: "delete",
          module: "clients",
        })
      );
    });
  });

  describe("getRecentActivities", () => {
    beforeEach(() => {
      // Setup mock data
      mockGetDocsResult = [
        {
          userId: "user-1",
          userEmail: "user1@example.com",
          userDisplayName: "المستخدم الأول",
          action: "create",
          module: "ledger",
          description: "إنشاء قيد",
          targetId: "entry-1",
          createdAt: { toDate: () => new Date("2024-01-15T10:00:00Z") },
        },
        {
          userId: "user-2",
          userEmail: "user2@example.com",
          action: "update",
          module: "clients",
          description: "تحديث عميل",
          metadata: { oldName: "قديم", newName: "جديد" },
          createdAt: { toDate: () => new Date("2024-01-15T09:00:00Z") },
        },
      ];
    });

    it("should query correct collection path", async () => {
      const { collection } = require("firebase/firestore");

      await getRecentActivities("owner-789");

      expect(collection).toHaveBeenCalledWith(expect.anything(), "users/owner-789/activity_logs");
    });

    it("should return activities with all fields", async () => {
      const activities = await getRecentActivities("owner-789");

      expect(activities).toHaveLength(2);
      expect(activities[0]).toEqual({
        id: "log-0",
        userId: "user-1",
        userEmail: "user1@example.com",
        userDisplayName: "المستخدم الأول",
        action: "create",
        module: "ledger",
        description: "إنشاء قيد",
        targetId: "entry-1",
        metadata: undefined,
        createdAt: expect.any(Date),
      });
    });

    it("should apply default limit of 50", async () => {
      const { limit } = require("firebase/firestore");

      await getRecentActivities("owner-789");

      expect(limit).toHaveBeenCalledWith(50);
    });

    it("should apply custom limit", async () => {
      const { limit } = require("firebase/firestore");

      await getRecentActivities("owner-789", { limitCount: 10 });

      expect(limit).toHaveBeenCalledWith(10);
    });

    it("should filter by module when specified", async () => {
      const { where } = require("firebase/firestore");

      await getRecentActivities("owner-789", { moduleFilter: "payments" });

      expect(where).toHaveBeenCalledWith("module", "==", "payments");
    });

    it("should filter by action when specified", async () => {
      const { where } = require("firebase/firestore");

      await getRecentActivities("owner-789", { actionFilter: "delete" });

      expect(where).toHaveBeenCalledWith("action", "==", "delete");
    });

    it("should apply both module and action filters", async () => {
      const { where } = require("firebase/firestore");

      await getRecentActivities("owner-789", {
        moduleFilter: "cheques",
        actionFilter: "create",
      });

      expect(where).toHaveBeenCalledWith("module", "==", "cheques");
      expect(where).toHaveBeenCalledWith("action", "==", "create");
    });

    it("should order by createdAt descending", async () => {
      const { orderBy } = require("firebase/firestore");

      await getRecentActivities("owner-789");

      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("should handle empty results", async () => {
      mockGetDocsResult = [];

      const activities = await getRecentActivities("owner-789");

      expect(activities).toHaveLength(0);
      expect(activities).toEqual([]);
    });

    it("should handle missing createdAt field", async () => {
      mockGetDocsResult = [
        {
          userId: "user-1",
          userEmail: "user@example.com",
          action: "create",
          module: "ledger",
          description: "Test",
          // No createdAt
        },
      ];

      const activities = await getRecentActivities("owner-789");

      expect(activities[0].createdAt).toBeInstanceOf(Date);
    });

    it("should handle missing optional fields in results", async () => {
      mockGetDocsResult = [
        {
          userId: "user-1",
          userEmail: "user@example.com",
          action: "create",
          module: "ledger",
          description: "Test",
          createdAt: { toDate: () => new Date() },
          // No userDisplayName, targetId, metadata
        },
      ];

      const activities = await getRecentActivities("owner-789");

      expect(activities[0].userDisplayName).toBeUndefined();
      expect(activities[0].targetId).toBeUndefined();
      expect(activities[0].metadata).toBeUndefined();
    });
  });

  describe("Integration Scenarios", () => {
    it("should log ledger entry creation", () => {
      const { addDoc } = require("firebase/firestore");

      logActivity("owner-123", {
        userId: "accountant-456",
        userEmail: "accountant@company.com",
        userDisplayName: "محاسب",
        action: "create",
        module: "ledger",
        targetId: "ledger-entry-789",
        description: "إنشاء قيد مبيعات بقيمة 5000 دينار",
        metadata: {
          amount: 5000,
          type: "دخل",
          category: "مبيعات",
        },
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "create",
          module: "ledger",
          targetId: "ledger-entry-789",
          metadata: expect.objectContaining({
            amount: 5000,
          }),
        })
      );
    });

    it("should log bad debt write-off", () => {
      const { addDoc } = require("firebase/firestore");

      logActivity("owner-123", {
        userId: "manager-789",
        userEmail: "manager@company.com",
        action: "write_off",
        module: "ledger",
        targetId: "receivable-123",
        description: "شطب دين معدوم للعميل شركة النور",
        metadata: {
          amount: 2500,
          clientName: "شركة النور",
          reason: "إفلاس العميل",
        },
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "write_off",
          module: "ledger",
        })
      );
    });

    it("should log user role change", () => {
      const { addDoc } = require("firebase/firestore");

      logActivity("owner-123", {
        userId: "owner-123",
        userEmail: "owner@company.com",
        action: "role_change",
        module: "users",
        targetId: "user-456",
        description: "تغيير دور المستخدم من مشاهد إلى محاسب",
        metadata: {
          oldRole: "مشاهد",
          newRole: "محاسب",
          targetEmail: "staff@company.com",
        },
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "role_change",
          module: "users",
          metadata: expect.objectContaining({
            oldRole: "مشاهد",
            newRole: "محاسب",
          }),
        })
      );
    });

    it("should fetch and filter recent activities", async () => {
      mockGetDocsResult = [
        {
          userId: "user-1",
          userEmail: "user@example.com",
          action: "create",
          module: "ledger",
          description: "قيد جديد",
          createdAt: { toDate: () => new Date() },
        },
      ];

      const activities = await getRecentActivities("owner-123", {
        moduleFilter: "ledger",
        actionFilter: "create",
        limitCount: 100,
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].module).toBe("ledger");
    });
  });
});
