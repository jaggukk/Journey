// Vercel's Node.js runtime can install request helpers before the function
// runs. It adds lazy `request.body`, `request.query`, and `request.cookies`
// accessors and may consume the raw request stream.
//
// Express owns `request.body` and `request.query`, and its JSON parser assigns
// to `request.body`. When the runtime's property is a getter without a setter,
// that assignment throws inside body-parser and the request fails with an
// opaque platform 500. Materializing the helper value into a normal writable
// property (and dropping the query/cookie helpers) keeps Express working in
// both configurations.

function findPropertyDescriptor(object, property) {
  let target = object;
  while (target) {
    const descriptor = Object.getOwnPropertyDescriptor(target, property);
    if (descriptor) return descriptor;
    target = Object.getPrototypeOf(target);
  }
  return null;
}

function removeOwnAccessor(object, property) {
  const descriptor = Object.getOwnPropertyDescriptor(object, property);
  if (!descriptor || !descriptor.get || !descriptor.configurable) return;
  try {
    delete object[property];
  } catch (error) {
    // A non-configurable accessor cannot be removed; leave it in place.
  }
}

export function prepareRequest(request) {
  removeOwnAccessor(request, "query");
  removeOwnAccessor(request, "cookies");

  const descriptor = findPropertyDescriptor(request, "body");
  if (!descriptor) return { ok: true };

  let body;
  try {
    body = request.body;
  } catch (error) {
    return { ok: false, error };
  }

  try {
    Object.defineProperty(request, "body", {
      value: body,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (error) {
    // A non-configurable own accessor cannot be replaced. If it has a setter,
    // Express can still assign to it and the request proceeds normally.
  }

  return { ok: true };
}
