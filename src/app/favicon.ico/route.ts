// Browsers request /favicon.ico by default (before reading the page's icon link). Send them to the SVG icon instead of a 404.
export function GET(req: Request) {
  return Response.redirect(new URL("/icon.svg", req.url), 308);
}
