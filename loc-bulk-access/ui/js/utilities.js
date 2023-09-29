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

  static storageGet(api, key, defaultValue) {
    return new Promise((resolve, reject) => {
      const obj = {};
      obj[key] = defaultValue;
      api.storage.local.get(obj).then((resp) => {
        let value = defaultValue;
        // load value if key exists
        if (resp !== undefined && key in resp) {
          value = resp[key];
        }
        resolve(value);
      // get failed
      }, (error) => {
        reject(new Error(error));
      });
    });
  }
}
