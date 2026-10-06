/** Parse Response JSON in tests (`Response.json()` is typed as `unknown`). */
export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
