declare namespace ExpectWebdriverIO {
  interface Matchers<R, T> {
    toContainFile(fileName: string): R
  }
}
