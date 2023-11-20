export default class Utilities {
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

  static getCSVString(data, headings = false, listDelimeter = ';') {
    if (data.length === 0) return '';
    const cols = headings ? headings.slice() : Object.keys(data[0]);
    const rows = data.map((item) => {
      const row = [];
      cols.forEach((col) => {
        if (col in item) {
          let value = item[col];
          if (Array.isArray(value)) {
            value = value.map((v) => String(v).replaceAll('"', '""'));
            value = value.join(listDelimeter);
          } else {
            value = String(value).replaceAll('"', '""');
          }
          row.push(`"${value}"`);
        } else row.push('');
      });
      return row;
    });
    rows.unshift(cols.map((col) => `"${col.replaceAll('"', '""')}"`));
    const rowStrings = rows.map((row) => row.join(','));
    return rowStrings.join('\r\n');
  }

  static getFileExtension(urlOrPath, defaultExt = 'jpg') {
    const parts = urlOrPath.split('.');
    if (parts.length <= 1) return defaultExt;
    const part = parts.pop();
    const hashParts = part.split('#');
    const [hashPart] = hashParts;
    const qParts = hashPart.split('?');
    const [ext] = qParts;
    if ('/' in ext) return defaultExt;
    return ext;
  }

  static getTimeString(withTime = true) {
    // YYYY-MM-DDTHH:mm:ss.sssZ -> YYYY-MM-DD HH:mm:ss
    const tString = new Date().toISOString().replace('T', ' ').replace(/\.[0-9]+Z/, '');
    if (withTime) return tString;
    return tString.split(' ')[0];
  }

  static parseQueryString(queryString) {
    const result = {};
    queryString.split('&').forEach((part) => {
      const [key, value] = part.split('=');
      result[key] = value;
    });
    return result;
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

  static stringToId(string) {
    let fn = String(string);
    fn = fn.replace(/[^a-zA-Z0-9 _-]/g, '');
    fn = fn.replace(/[ _-]+/g, '-');
    fn = fn.toLowerCase();
    return fn;
  }
}
