export interface ICallback<TReturnValue> {
  (error: Error | null, returnValue: TReturnValue): void;
}
