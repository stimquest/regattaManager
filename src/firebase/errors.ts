
import { errorEmitter } from '@/firebase/error-emitter';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(
      {
        context,
      },
      null,
      2
    )}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This is necessary for custom errors to work correctly with instanceof
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: `The following request was denied by Firestore Security Rules`,
      context: this.context,
    };
  }
}

/**
 * Emits a Firestore permission error through the central error emitter.
 * This function is a convenience wrapper to create and emit a FirestorePermissionError.
 * @param serverError - The original error thrown by the Firestore SDK.
 * @param context - The context of the Firestore operation that failed.
 */
export function emitFirestoreError(serverError: any, context: SecurityRuleContext) {
  // We log the original server error for debugging purposes but proceed with our custom error.
  console.warn('Original Firestore SDK Error:', serverError);
  
  const permissionError = new FirestorePermissionError(context);
  errorEmitter.emit('permission-error', permissionError);
}
