import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getPayments, getPaymentById, createPaymentWithAllocations,
  updatePayment, deletePayment,
  getAllocationsForPayment, getAllocationsForTransaction,
  createAllocation, deleteAllocationsForPayment,
  type PaymentWithAllocations, type NewAllocationRow,
} from '../queries/payments.queries';

export function registerPaymentsHandlers(): void {
  ipcMain.handle('payments:getAll', (_, profileId: string) =>
    getPayments(getActiveDb(), profileId)
  );

  ipcMain.handle('payments:getById', (_, id: string) =>
    getPaymentById(getActiveDb(), id)
  );

  ipcMain.handle('payments:createWithAllocations', (_, data: PaymentWithAllocations) =>
    createPaymentWithAllocations(getActiveDb(), data)
  );

  ipcMain.handle('payments:update', (_, id: string, data: Record<string, unknown>) =>
    updatePayment(getActiveDb(), id, data)
  );

  ipcMain.handle('payments:delete', (_, id: string) =>
    deletePayment(getActiveDb(), id)
  );

  ipcMain.handle('allocations:getForPayment', (_, paymentId: string) =>
    getAllocationsForPayment(getActiveDb(), paymentId)
  );

  ipcMain.handle('allocations:getForTransaction', (_, transactionId: string) =>
    getAllocationsForTransaction(getActiveDb(), transactionId)
  );

  ipcMain.handle('allocations:create', (_, data: NewAllocationRow) =>
    createAllocation(getActiveDb(), data)
  );

  ipcMain.handle('allocations:deleteForPayment', (_, paymentId: string) =>
    deleteAllocationsForPayment(getActiveDb(), paymentId)
  );
}
