# Validation & Error Handling Guide

## Overview

This guide explains how to use the comprehensive validation and error handling system in FactoryFlow. The system provides:

- ✅ Type-safe validation with Zod schemas
- ✅ Duplicate detection
- ✅ Enhanced error messages in Arabic
- ✅ Consistent error handling across the application
- ✅ Validated form components

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Schemas](#available-schemas)
3. [Using ValidatedInput](#using-validatedinput)
4. [Duplicate Detection](#duplicate-detection)
5. [Error Handling](#error-handling)
6. [Helper Functions](#helper-functions)
7. [Examples](#examples)

---

## Quick Start

### Basic Form Validation

```typescript
import { useState } from 'react';
import { clientSchema, type ClientInput } from '@/lib/validation';
import { handleError, getErrorTitle, getSuccessMessage } from '@/lib/error-handling';
import { ValidatedInput } from '@/components/ui/validated-input';

function MyForm() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    balance: "0",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Parse and validate with Zod
      const validated = clientSchema.parse({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        balance: parseFloat(formData.balance),
      });

      // Save to database...

      toast({
        title: "تمت الإضافة بنجاح",
        description: "تم حفظ البيانات",
      });
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <ValidatedInput
        label="الاسم"
        name="name"
        value={formData.name}
        onChange={(value) => setFormData({ ...formData, name: value })}
        required
        error={validationErrors.name}
      />
      {/* More fields... */}
    </form>
  );
}
```

---

## Available Schemas

### Client Schema

```typescript
import { clientSchema, type ClientInput } from '@/lib/validation';

const client: ClientInput = {
  name: "محمد أحمد",          // Required, 1-100 chars
  phone: "0791234567",        // Optional, 7-20 digits
  email: "test@example.com",  // Optional, valid email
  address: "عمان",            // Optional, max 200 chars
  balance: 0,                 // Optional, defaults to 0
};

const validated = clientSchema.parse(client);
```

### Partner Schema

```typescript
import { partnerSchema, type PartnerInput } from '@/lib/validation';

const partner: PartnerInput = {
  name: "شريك 1",
  phone: "0791234567",
  email: "partner@example.com",
  address: "عمان",
  equityBalance: 50000,
};

const validated = partnerSchema.parse(partner);
```

### Ledger Entry Schema

```typescript
import { ledgerEntrySchema, type LedgerEntryInput } from '@/lib/validation';

const entry: LedgerEntryInput = {
  date: new Date(),
  category: "مبيعات",
  amount: 1000,
  type: "income",
  description: "بيع منتجات",
  paymentMethod: "cash",
};

const validated = ledgerEntrySchema.parse(entry);
```

### Cheque Schema

```typescript
import { chequeSchema, type ChequeInput } from '@/lib/validation';

const cheque: ChequeInput = {
  chequeNumber: "CHK-001",
  amount: 5000,
  date: new Date(),
  dueDate: new Date("2025-12-31"),
  type: "incoming",
  status: "pending",
  bank: "البنك الأهلي",
};

const validated = chequeSchema.parse(cheque);
```

### Inventory Item Schema

```typescript
import { inventoryItemSchema, type InventoryItemInput } from '@/lib/validation';

const item: InventoryItemInput = {
  name: "منتج 1",
  category: "الكترونيات",
  quantity: 10,
  unit: "قطعة",
  costPrice: 100,
  sellingPrice: 150,  // Must be >= costPrice
  minStock: 5,
};

const validated = inventoryItemSchema.parse(item);
```

---

## Using ValidatedInput

The `ValidatedInput` component provides built-in validation feedback:

```typescript
import { ValidatedInput } from '@/components/ui/validated-input';

<ValidatedInput
  label="الاسم"
  name="name"
  value={formData.name}
  onChange={(value) => setFormData({ ...formData, name: value })}

  // Optional props
  required={true}
  error={validationErrors.name}
  hint="اسم العميل الكامل"
  maxLength={100}
  type="text"
  placeholder="أدخل الاسم"
  disabled={false}
  showSuccessIndicator={true}
/>
```

### Features

- ✅ Real-time validation feedback
- ✅ Success/error icons
- ✅ Character counter
- ✅ Hint text
- ✅ Arabic error messages
- ✅ Accessibility support

---

## Duplicate Detection

### Check for Duplicate Client

```typescript
import { checkDuplicateClient } from '@/lib/validation';

const isDuplicate = await checkDuplicateClient(
  "محمد أحمد",  // Client name
  user.uid,      // User ID
  clientId       // Exclude this ID (for updates)
);

if (isDuplicate) {
  toast({
    title: "عميل مكرر",
    description: "يوجد عميل بنفس الاسم مسبقاً",
    variant: "destructive",
  });
}
```

### Check for Duplicate Cheque

```typescript
import { checkDuplicateCheque } from '@/lib/validation';

const isDuplicate = await checkDuplicateCheque(
  "CHK-001",
  user.uid,
  chequeId
);
```

### Check for Duplicate SKU

```typescript
import { checkDuplicateSKU } from '@/lib/validation';

const isDuplicate = await checkDuplicateSKU(
  "SKU-123",
  user.uid,
  itemId
);
```

### Generic Duplicate Check

```typescript
import { checkDuplicate } from '@/lib/validation';

const isDuplicate = await checkDuplicate({
  collection: 'clients',
  field: 'email',
  value: 'test@example.com',
  userId: user.uid,
  excludeId: clientId,
});
```

---

## Error Handling

### Handling Errors

```typescript
import { handleError, getErrorTitle, logError } from '@/lib/error-handling';

try {
  // Your code...
} catch (error) {
  const appError = handleError(error);

  // Log error (console in dev, could send to service in prod)
  logError(appError, { context: 'saveClient' }, user?.uid);

  // Show toast
  toast({
    title: getErrorTitle(appError),
    description: appError.message,
    variant: "destructive",
  });
}
```

### Error Types

```typescript
import { ErrorType } from '@/lib/error-handling';

ErrorType.VALIDATION    // Data validation errors
ErrorType.FIREBASE      // Firebase/Firestore errors
ErrorType.NETWORK       // Network/connectivity errors
ErrorType.DUPLICATE     // Duplicate entry errors
ErrorType.NOT_FOUND     // Resource not found
ErrorType.PERMISSION    // Permission denied
ErrorType.UNKNOWN       // Unknown errors
```

### Retry Logic

```typescript
import { retryOperation } from '@/lib/error-handling';

const data = await retryOperation(
  async () => {
    return await fetchData();
  },
  {
    maxAttempts: 3,
    delayMs: 1000,
    backoff: true,  // Exponential backoff
  }
);
```

---

## Helper Functions

### Data Sanitization

```typescript
import { sanitizeString, parseNumericInput } from '@/lib/validation';

// Clean up strings
const clean = sanitizeString("  hello   world  ");
// Result: "hello world"

// Parse numbers safely
const num = parseNumericInput("1,234.56");
// Result: 1234.56

const invalid = parseNumericInput("abc");
// Result: null
```

### Date Validation

```typescript
import { validateReasonableDate } from '@/lib/validation';

const isValid = validateReasonableDate(new Date("2030-01-01"));
// Returns: false (more than 1 year in future)
```

### Amount Validation

```typescript
import { validateReasonableAmount } from '@/lib/validation';

const isValid = validateReasonableAmount(1000);
// Returns: true

const tooLarge = validateReasonableAmount(2000000000);
// Returns: false
```

### Validate Form Data

```typescript
import { validateData } from '@/lib/validation';

const result = validateData(clientSchema, formData);

if (result.success) {
  console.log(result.data);  // Validated data
} else {
  console.log(result.errors);  // Array of error messages
}
```

---

## Examples

### Complete Form Example

See `/src/components/clients/clients-page.tsx` for a full example of:
- Form with validated inputs
- Zod schema validation
- Duplicate detection
- Error handling
- Success messages
- Loading states

### Key Features Demonstrated

1. **Real-time Validation**
   ```typescript
   const validateForm = (data: typeof formData): boolean => {
     // Validate and set errors...
     return Object.keys(errors).length === 0;
   };
   ```

2. **Duplicate Check on Submit**
   ```typescript
   const isDuplicate = await checkDuplicateClient(
     formData.name,
     user.uid,
     editingClient?.id
   );
   ```

3. **Zod Parsing**
   ```typescript
   const validated = clientSchema.parse(clientData);
   ```

4. **Error Display**
   ```typescript
   <ValidatedInput
     error={validationErrors.name}
     // ...other props
   />
   ```

5. **Success Feedback**
   ```typescript
   const successMsg = getSuccessMessage('create', 'العميل');
   toast({
     title: successMsg.title,
     description: successMsg.description,
   });
   ```

---

## Best Practices

### ✅ DO

- Always use Zod schemas for validation
- Check for duplicates before saving
- Use `handleError()` for consistent error handling
- Sanitize user input with `sanitizeString()`
- Parse numbers with `parseNumericInput()`
- Log errors in catch blocks
- Show user-friendly Arabic messages

### ❌ DON'T

- Don't use `parseFloat()` directly - use `parseNumericInput()`
- Don't write custom error messages - use the error handling system
- Don't skip duplicate checks on unique fields
- Don't forget to validate before saving to Firestore
- Don't show technical error details to users

---

## Testing

All validation and error handling functions have comprehensive tests:

- `/src/lib/__tests__/validation.test.ts`
- `/src/lib/__tests__/error-handling.test.ts`

Run tests with:
```bash
npm test
```

---

## Migration Guide

### Updating Existing Forms

1. Import the validation schema and helpers:
   ```typescript
   import { clientSchema } from '@/lib/validation';
   import { handleError } from '@/lib/error-handling';
   import { ValidatedInput } from '@/components/ui/validated-input';
   ```

2. Replace `Input` with `ValidatedInput`:
   ```typescript
   // Before
   <Input
     value={formData.name}
     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
   />

   // After
   <ValidatedInput
     label="الاسم"
     name="name"
     value={formData.name}
     onChange={(value) => setFormData({ ...formData, name: value })}
     error={validationErrors.name}
   />
   ```

3. Add validation to submit handler:
   ```typescript
   try {
     const validated = clientSchema.parse(formData);
     // Save...
   } catch (error) {
     const appError = handleError(error);
     toast({
       title: getErrorTitle(appError),
       description: appError.message,
       variant: "destructive",
     });
   }
   ```

4. Add duplicate check if needed:
   ```typescript
   const isDuplicate = await checkDuplicateClient(name, userId);
   if (isDuplicate) {
     // Show error...
     return;
   }
   ```

---

## Support

For questions or issues with the validation system, contact the development team or open an issue in the repository.
