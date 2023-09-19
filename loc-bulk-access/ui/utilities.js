class Utilities {
  static appendParamsToURL(urlString, params) {
    const url = new URL(urlString);
    const { searchParams } = url;
    Object.entries(params).forEach(
      ([key, value]) => searchParams.set(key, value),
    );
    const searchString = searchParams.toString();
    const parts = [url.protocol, '//', url.host, url.pathname, '?', searchString];
    const newURL = parts.join('');
    return newURL;
  }
}
