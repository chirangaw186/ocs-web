export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 422 | 500, message: string, public code = "error") {
    super(message);
  }
}
export class OutOfStockError extends HttpError {
  constructor(public sku: string) {
    super(409, `Not enough stock for ${sku}`, "out_of_stock");
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} not found`, "not_found");
