/*
Functions that contain logic specific to LOC
*/

// function for validating an API response
const apiResponseValidator = (apiResponse) => {
  const resp = { valid: false, message: 'This is not a valid page. Please search or navigate to a page with at least one collection item.' };
  if ('item' in apiResponse) {
    resp.valid = true;
    resp.message = 'Found one item on this page.';
    resp.type = 'item';
    resp.count = 1;
    resp.countF = '1';
    resp.title = apiResponse.item.title;
    resp.uid = Utilities.stringToId(resp.title);
    resp.facets = [];
  } else if ('pagination' in apiResponse && 'results' in apiResponse) {
    if (apiResponse.results.length > 0 && 'item' in apiResponse.results[0]) {
      const count = apiResponse.pagination.of;
      const countF = count.toLocaleString();
      resp.valid = true;
      resp.type = 'query';
      resp.count = count;
      resp.countF = countF;
      resp.title = 'Search result';
      resp.message = `Found <strong>${countF} items</strong> in this search result.`;
      if ('site_type' in apiResponse && apiResponse.site_type === 'collections') {
        resp.message = `Found <strong>${countF} items</strong> in this collection.`;
        resp.type = 'collection';
        if ('title' in apiResponse) resp.title = apiResponse.title;
      }
      resp.facets = [];
      if ('search' in apiResponse) {
        const { search } = apiResponse;
        resp.facets = 'facet_limits' in search ? search.facet_limits.split('|') : [];
        if ('query' in search && search.query.length > 0) resp.facets.unshift(`query:"${search.query}"`);
      }
      resp.uid = Utilities.stringToId(`${resp.title}-${resp.facets.join('-').replaceAll(':', '-')}`);
    }
    if ('uid' in resp) {
      // max 80 characters
      resp.uid = resp.uid.slice(0, 80);
      // add timestamp
      resp.uid = Utilities.stringToId(`${resp.uid}-${Utilities.getTimeString()}`);
    }
  }
  return resp;
};

// function for creating an API URL based on current URL
const getAPIURL = (url, count = false) => {
  const urlPattern = /https?:\/\/.*\.loc\.gov\/.*/i;
  const params = { fo: 'json' };
  if (count !== false) params.c = count;
  if (urlPattern.test(url)) return Utilities.appendParamsToURL(url, params);
  return false;
};

// parse an arbitrary field
const parseField = (object, key, expectedType = 'string', defaultValue = '') => {
  if (!(key in object)) return defaultValue;
  let value = object[key];

  // check for falsey values
  if (value === null || value === undefined || value === false) return defaultValue;

  // check for empty arrays
  if (Array.isArray(value) && value.length === 0) return defaultValue;

  // take the first entry of an array if we expect a string
  if (expectedType === 'string' && Array.isArray(value)) value = value[0];

  // parse bool
  if (typeof value === 'boolean') value = value ? 'true' : 'false';

  // convert to string if we expect a string and it is not a string
  if (expectedType === 'string' && typeof value !== 'string') value = String(value);

  // parse an integer
  if (expectedType === 'int') value = parseInt(value, 10);

  // parse array
  if (expectedType === 'array' && !Array.isArray(value)) value = [value];

  // check if the array is a list of strings
  if (expectedType === 'array') {
    value = value.map((entry) => {
      let stringValue = entry;
      // check if entry is an object
      if (typeof entry === 'object') {
        const keys = Object.keys(entry);
        if (keys.length > 0) {
          // check if the object has a title
          if (keys.includes('title')) stringValue = entry.title;
          // otherwise take the first key
          else stringValue = key[0];
        } else stringValue = '';
      }
      if (typeof stringValue !== 'string') stringValue = String(stringValue);
      return stringValue;
    });
  }

  return value;
};

const getResourceUrl = (resources, key, validFileTypes) => {
  if (resources.length === 0) return '';

  // get file extension for each resource
  const rs = resources.map((r) => {
    const rcopy = r;
    let ext = '';
    if (key in r) {
      const url = r[key];
      const parts = url.split('.');
      if (parts.length > 1) ext = `.${parts[parts.length - 1]}`;
    }
    rcopy.ext = ext;
    return rcopy;
  });

  // filter to only valid file types
  const validResources = resources.filter((r) => key in r && validFileTypes.includes(r.ext));
  if (validResources.length === 0) {
    const first = resources.find((r) => key in r);
    if (first) return first[key];
    return '';
  }

  // sort by file extension priority
  validResources.sort((a, b) => validFileTypes.indexOf(a.ext) - validFileTypes.indexOf(b.ext));
  return validResources[0][key];
};

// function for parsing a single item from the API
const parseItem = (item) => {
  const resp = {};

  resp.id = parseField(item, 'number_lccn');
  resp.title = parseField(item, 'title');
  resp.url = parseField(item, 'url');
  resp.original_format = parseField(item, 'original_format');
  resp.online_formats = parseField(item, 'online_format', 'array', []);
  resp.subjects = parseField(item, 'subject', 'array', []);
  resp.date = parseField(item, 'date');
  resp.description = parseField(item, 'description');
  resp.contributors = parseField(item, 'contributor', 'array', []);
  resp.locations = parseField(item, 'location', 'array', []);
  resp.partof = parseField(item, 'partof', 'array', []);
  resp.access_restricted = parseField(item, 'access_restricted');

  // get the last image, which is the largest
  const imageURLs = parseField(item, 'image_url', 'array', []);
  const imgCount = imageURLs.length;
  resp.image_url = imgCount > 0 ? imageURLs[imgCount - 1] : '';

  // get the resource URL
  const { resources } = item;
  let resourceUrl = '';
  // check for video
  if (resp.online_formats.includes('video')) {
    resourceUrl = getResourceUrl(resources, 'video', ['.mp4', '.ogv', '.wmv', '.mpg', '.mkv', '.mov', '.avi']);
  }
  // check for audio
  if (resourceUrl === '' && resp.online_formats.includes('audio')) {
    resourceUrl = getResourceUrl(resources, 'audio', ['.mp3', '.ogg', '.wma', '.aiff', '.wav', '.flac']);
  }
  // otherwise, take the image
  if (resourceUrl === '') resourceUrl = resp.image_url;
  resp.resource_url = resourceUrl;

  return resp;
};

// function for parsing an API response for downloading
const parseAPIResponse = (apiResponse) => {
  const resp = {
    nextPageURL: false,
    isLast: false,
    total: false,
  };
  // this is an item
  if ('item' in apiResponse) {
    resp.results = [parseItem(apiResponse.item)];
    resp.isLast = true;
    resp.total = 1;
  // this is a list of items (search or collection)
  } else if ('pagination' in apiResponse && 'results' in apiResponse) {
    if (apiResponse.results.length > 0 && 'item' in apiResponse.results[0]) {
      const { pagination, results } = apiResponse;
      // check for next page
      resp.nextPageURL = 'next' in pagination && typeof pagination.next === 'string' && pagination.next.length > 0
        ? pagination.next : false;
      if (resp.nextPageURL === false) resp.isLast = true;
      resp.total = pagination.total;
      resp.results = results.map((result) => parseItem(result));
    }
  } else {
    return false;
  }
  return resp;
};
