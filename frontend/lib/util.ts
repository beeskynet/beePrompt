export function ssgPagePath(path: string) {
  return process.env.NODE_ENV === "development" ? path : `${path}.html`;
}
