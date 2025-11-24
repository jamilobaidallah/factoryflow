# Firestore Indexes Setup

## Why Indexes Are Needed

Firestore requires composite indexes when you:
1. Use multiple `where()` clauses with `orderBy()`
2. Use range filters (`>=`, `<=`, `>`, `<`) with `orderBy()` on different fields
3. Query large datasets efficiently

Without proper indexes, queries will fail with an error message providing a link to create the index.

## Indexes Defined

This project includes the following composite indexes in `firestore.indexes.json`:

### Ledger Collection
- **date** (ascending/descending) - For date range queries
- **category + subCategory** - For subcategory analysis reports
- **associatedParty + date** - For client transaction history

### Payments Collection
- **date** (ascending/descending) - For payment reports
- **clientName + date** - For client payment history

### Cheques Collection
- **clientName + dueDate** - For client cheque tracking
- **status + dueDate** - For cheque status reports
- **type + dueDate** - For incoming/outgoing cheque filtering

## Deployment Methods

### Method 1: Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase** (if not done already):
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Accept default rules file
   - Accept default indexes file

4. **Deploy indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. **Check deployment status**:
   - Indexes can take several minutes to build
   - Check progress in Firebase Console → Firestore → Indexes tab

### Method 2: Firebase Console (Manual)

If a query fails, Firestore will provide an error message with a direct link to create the index:

1. Copy the error URL from console
2. Open the link in your browser
3. Click "Create Index"
4. Wait for index to build (can take 5-10 minutes)

Example error:
```
The query requires an index. You can create it here:
https://console.firebase.google.com/project/YOUR_PROJECT/...
```

### Method 3: Import via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Add Index** manually for each index from `firestore.indexes.json`

## Monitoring Index Build Status

After deployment:

1. Go to Firebase Console → Firestore → Indexes
2. Check status:
   - 🟢 **Enabled** - Index is ready
   - 🟡 **Building** - Index is being created (wait 5-30 minutes)
   - 🔴 **Error** - Check error message and fix

## Testing After Deployment

Test these features to ensure indexes are working:

1. **Reports Page** - Generate income statement with date range
2. **Subcategory Analysis** - Filter by category and subcategory
3. **Client Details** - View client transaction history
4. **Cheques Management** - Filter cheques by status

If any query fails with "requires an index" error, use the provided link to create it.

## Maintenance

- **Check index usage**: Firebase Console → Firestore → Usage tab
- **Remove unused indexes**: Delete from `firestore.indexes.json` and redeploy
- **Add new indexes**: When new queries fail, add to config file

## Performance Notes

- Indexes consume storage and write operations
- Each indexed field is updated on every document write
- More indexes = slower writes, faster reads
- Current setup: ~10 indexes ≈ minimal overhead for small datasets
- Consider for large datasets (>100k docs): Evaluate index necessity

## Troubleshooting

### "Index already exists" error
- Safe to ignore - index is already deployed
- Or delete duplicate from `firestore.indexes.json`

### Queries still slow after indexing
- Check query design (avoid large result sets)
- Add pagination (limit queries)
- Consider denormalization for frequently accessed data

### Build never completes
- Large datasets can take hours
- Check Firebase Console for errors
- Try deleting and recreating the index

## Cost Implications

**Free Tier Limits:**
- 200 composite indexes (we use ~10)
- Index storage: Counts toward 1 GB limit

**Pricing:**
- Minimal cost for small businesses (<10k transactions/month)
- Index storage: ~$0.18/GB/month
- Index writes: Included in document write costs

Estimated for FactoryFlow with 5k transactions/month: **< $1/month** for indexes.
