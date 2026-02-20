# Custom Alerts Migration Guide

## Overview
This guide explains how to migrate from native browser `alert()` and `confirm()` calls to our custom modal system for a better user experience.

## Why Custom Modals?

### Problems with Native Alerts:
- ❌ Blocks the entire browser thread
- ❌ Cannot be styled to match app design
- ❌ Poor mobile experience
- ❌ No animation or smooth transitions
- ❌ Inconsistent appearance across browsers

### Benefits of Custom Modals:
- ✅ Non-blocking, smooth animations
- ✅ Consistent with app design language
- ✅ Better mobile UX
- ✅ Customizable (icons, colors, buttons)
- ✅ Accessible and keyboard-friendly

## Implementation

### 1. Components Created

#### `CustomAlertModal.tsx`
A beautiful, customizable alert modal with support for:
- **Types**: `info`, `success`, `error`, `warning`
- Animated entrance/exit
- Custom icons for each type
- Color-coded for visual distinction

#### `CustomConfirmModal.tsx`
A confirmation dialog with:
- **Variants**: `default`, `danger`, `warning`
- Two action buttons (Confirm/Cancel)
- Promise-based API for async/await usage
- Customizable button text

#### `AlertContext.tsx`
Global context provider that manages modal state across the entire app.

### 2. How to Use

#### Import the Hook
```typescript
import { useAlert } from '../contexts/AlertContext';
```

#### In Your Component
```typescript
function MyComponent() {
  const { showAlert, showConfirm } = useAlert();

  // Show an alert
  const handleSuccess = () => {
    showAlert({
      title: 'Success!',
      message: 'Your changes have been saved.',
      type: 'success'
    });
  };

  // Show a confirmation dialog
  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (confirmed) {
      // User clicked Delete
      performDelete();
    }
  };

  return (
    <div>
      <button onClick={handleSuccess}>Save</button>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
}
```

### 3. Migration Examples

#### Before (Native Alert):
```typescript
alert('Track downloaded for offline listening!');
```

#### After (Custom Alert):
```typescript
showAlert({
  message: 'Track downloaded for offline listening!',
  type: 'success'
});
```

---

#### Before (Native Confirm):
```typescript
const confirmed = confirm('Are you sure you want to delete this playlist?');
if (confirmed) {
  deletePlaylist();
}
```

#### After (Custom Confirm):
```typescript
const confirmed = await showConfirm({
  title: 'Delete Playlist',
  message: 'Are you sure you want to delete this playlist? This action cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  variant: 'danger'
});

if (confirmed) {
  deletePlaylist();
}
```

## API Reference

### `showAlert(options)`

Shows an alert modal.

**Options:**
```typescript
{
  title?: string;           // Optional title
  message: string;          // Required message
  type?: 'info' | 'success' | 'error' | 'warning';  // Default: 'info'
}
```

**Example:**
```typescript
showAlert({
  title: 'Payment Successful',
  message: 'Your treats have been added to your wallet.',
  type: 'success'
});
```

---

### `showConfirm(options)`

Shows a confirmation dialog and returns a Promise.

**Options:**
```typescript
{
  title?: string;                    // Optional title
  message: string;                   // Required message
  confirmText?: string;              // Default: 'Confirm'
  cancelText?: string;               // Default: 'Cancel'
  variant?: 'default' | 'danger' | 'warning';  // Default: 'default'
}
```

**Returns:** `Promise<boolean>` - `true` if confirmed, `false` if cancelled

**Example:**
```typescript
const confirmed = await showConfirm({
  title: 'Remove Track',
  message: 'Remove this track from the playlist?',
  confirmText: 'Remove',
  cancelText: 'Keep',
  variant: 'warning'
});
```

## Styling Guide

### Alert Types

#### Info (default)
- Blue color scheme
- Info icon
- Use for general notifications

#### Success
- Green color scheme
- Check circle icon
- Use for successful operations

#### Error
- Red color scheme
- Alert circle icon
- Use for errors and failures

#### Warning
- Yellow color scheme
- Alert circle icon
- Use for warnings

### Confirm Variants

#### Default
- Green accent color
- Use for general confirmations

#### Danger
- Red accent color
- Trash icon
- Use for destructive actions (delete, remove, etc.)

#### Warning
- Yellow accent color
- Warning icon
- Use for actions that need caution

## Current Status

### ✅ Completed
1. Created `CustomAlertModal` component
2. Created `CustomConfirmModal` component
3. Created `AlertContext` and `useAlert` hook
4. Integrated `AlertProvider` into app root
5. Created migration utilities

### 📋 Next Steps
1. Gradually replace `alert()` calls in high-traffic areas
2. Replace `confirm()` calls in critical flows
3. Test on various devices and screen sizes
4. Monitor user feedback

## Files Modified

### New Files:
- `/src/components/CustomAlertModal.tsx` - Alert modal component
- `/src/components/CustomConfirmModal.tsx` - Confirm modal component
- `/src/contexts/AlertContext.tsx` - Global context provider
- `/src/lib/customAlerts.ts` - Migration utilities
- `CUSTOM_ALERTS_MIGRATION_GUIDE.md` - This guide

### Modified Files:
- `/src/index.tsx` - Added AlertProvider wrapper

## Testing Checklist

- [ ] Alert modal shows correctly
- [ ] Confirm modal shows correctly
- [ ] Animations work smoothly
- [ ] Backdrop dismisses modals
- [ ] Close button works
- [ ] Confirm/Cancel buttons work
- [ ] Multiple modals don't stack
- [ ] Works on mobile devices
- [ ] Keyboard navigation works
- [ ] Accessible with screen readers

## Future Enhancements

Consider adding:
- Input prompts (like `window.prompt()`)
- Toast notifications for non-blocking messages
- Custom action buttons beyond Confirm/Cancel
- Sound effects for alerts
- Haptic feedback on mobile

## Support

If you encounter issues or have questions about migrating to custom modals, refer to:
- This guide
- `AlertContext.tsx` source code
- Example usages in the codebase

---

**Last Updated:** November 23, 2025
**Status:** ✅ Ready for gradual adoption
