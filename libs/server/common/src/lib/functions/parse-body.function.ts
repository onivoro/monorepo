export function parseBody<T = any>(body: { '{}': any }) {
  return JSON.parse(body['{}']) as T;
}
