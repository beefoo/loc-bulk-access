import Utilities from './utilities.js';
/*
Functions that contain logic specific to LOC
*/
export default class LOC {
  // function for validating an API response
  static apiResponseValidator(apiResponse) {
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
    }
    if ('uid' in resp) {
      // max 80 characters
      resp.uid = resp.uid.slice(0, 80);
      // add timestamp
      resp.uid = Utilities.stringToId(`${resp.uid}-${Utilities.getTimeString(false)}`);
    }
    return resp;
  }

  static getFormatExtensions(format) {
    const formatFileExtensions = {
      audio: ['.mp3', '.ogg', '.wma', '.aiff', '.wav', '.flac'],
      image: ['.jpg', '.jpeg', '.png', '.gif'],
      'online text': ['.txt'],
      video: ['.mp4', '.ogv', '.wmv', '.mpg', '.mkv', '.mov', '.avi'],
    };
    return formatFileExtensions[format];
  }

  // function for creating an API URL based on current URL
  static getAPIURL(url, count = false) {
    if (!url) return false;
    const urlPattern = /https?:\/\/.*\.loc\.gov\/.*/i;
    const params = { fo: 'json' };
    if (count !== false) params.c = count;
    if (urlPattern.test(url)) return Utilities.appendParamsToURL(url, params);
    return false;
  }

  // function to retrieve a resource URL from a set of resources
  static getResourceUrl(resources, key, validFileTypes) {
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
  }

  // function for parsing an API response for downloading
  static parseAPIResponse(apiResponse) {
    const resp = {
      nextPageURL: false,
      isLast: false,
      total: false,
    };
    // this is an item
    if ('item' in apiResponse) {
      const item = LOC.parseItem(apiResponse.item);
      resp.results = [item];
      const resource = LOC.parseResources(item, apiResponse.item, apiResponse.resources);
      resp.resources = [resource];
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
        resp.results = results.map((result) => LOC.parseItem(result));
        resp.resources = results.map((result, j) => LOC.parseResources(resp.results[j], result));
      }
    } else {
      return false;
    }
    // add resources and filenames to results
    resp.results.forEach((result, i) => {
      resp.results[i].resource_url = resp.resources[i][0].url;
      resp.results[i].filename = resp.resources[i][0].filename;
    });
    return resp;
  }

  // parse an arbitrary field
  static parseField(object, key, expectedType = 'string', defaultValue = '') {
    if (!(key in object)) return defaultValue;
    let value = object[key];

    // check for falsey values
    if (value === null || value === undefined) return defaultValue;

    // check for empty arrays
    if (Array.isArray(value) && value.length === 0) return defaultValue;

    // take the first entry of an array if we expect a string
    if (expectedType === 'string' && Array.isArray(value)) value = value[0];

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
  }

  // function for parsing a single item from the API
  static parseItem(item) {
    const resp = {};

    resp.url = LOC.parseField(item, 'url');
    resp.title = LOC.parseField(item, 'title');
    resp.original_format = LOC.parseField(item, 'original_format');
    resp.online_formats = LOC.parseField(item, 'online_format', 'array', []);
    resp.subjects = LOC.parseField(item, 'subject', 'array', []);
    resp.date = LOC.parseField(item, 'date');
    resp.description = LOC.parseField(item, 'description');
    resp.contributors = LOC.parseField(item, 'contributor', 'array', []);
    resp.locations = LOC.parseField(item, 'location', 'array', []);
    resp.partof = LOC.parseField(item, 'partof', 'array', []);
    resp.access_restricted = LOC.parseField(item, 'access_restricted');

    // derive the id from the URL
    // usually something like https://www.loc.gov/item/sn82015409/
    // but can be something like https://www.loc.gov/item/sn82015409/1940-07-21/ed-1/
    try {
      const url = new URL(resp.url);
      const { pathname } = url;
      let idString = pathname.startsWith('/item/') ? pathname.slice('/item/'.length) : pathname;
      idString = idString.replace(/\/$/, '').replace(/^\//, ''); // remove slashes from beginning and end
      resp.id = idString.replaceAll('/', '-');
    } catch (error) {
      resp.id = Utilities.stringToId(resp.url);
    }

    // get the last image, which is the largest
    const imageURLs = LOC.parseField(item, 'image_url', 'array', []);
    const imgCount = imageURLs.length;
    resp.image_url = imgCount > 0 ? imageURLs[imgCount - 1] : '';
    resp.thumb_url = imgCount > 0 ? imageURLs[0] : '';

    // get the resource URL
    const { resources } = item;

    // get resource count
    resp.resource_count = 1;
    if (resources && resources.length > 0) {
      const [firstResource] = resources;
      resp.resource_count = 'files' in firstResource ? firstResource.files : 1;
    }

    return resp;
  }

  static parseResources(item, apiItem, apiResources = []) {
    const resp = [];
    const { resources } = apiItem;

    // check for non-image resources
    const supportedFormats = ['video', 'audio', 'online text'];

    // determine format and resource URL
    let resourceUrl = '';
    let format = '';
    supportedFormats.forEach((sformat) => {
      if (format !== '') return;
      if (item.online_formats.includes(sformat)) {
        const rKey = sformat === 'online text' ? 'fulltext_file' : sformat;
        const rValue = LOC.getResourceUrl(resources, rKey, LOC.getFormatExtensions(sformat));
        if (rValue !== '') {
          format = sformat;
          resourceUrl = rValue;
        }
      }
    });
    if (format === '') {
      format = 'image';
      resourceUrl = item.image_url;
    }
    const formats = [{ format, resourceUrl }];
    // also download the image if it is text
    if (format === 'online text') formats.push({ format: 'image', resourceUrl: item.image_url });

    // generate different size resources for images
    const imageURLs = LOC.parseField(apiItem, 'image_url', 'array', []);
    const imgCount = imageURLs.length;

    formats.forEach((f) => {
      const fileExtension = Utilities.getFileExtension(f.resourceUrl);
      const resource = {
        itemURL: item.url,
        url: f.resourceUrl,
        format: f.format,
        fileExtension,
        filename: `${item.id}.${fileExtension}`,
        status: 'queued',
        attempts: 0,
      };
      // generate different size resources for images
      ['smallestUrl', 'mediumUrl', 'largestUrl'].forEach((urlKey) => {
        if (f.format !== 'image') resource[urlKey] = resource.url;
        else if (urlKey === 'largestUrl') resource[urlKey] = imageURLs[imgCount - 1];
        else if (urlKey === 'smallestUrl') resource[urlKey] = imageURLs[0];
        else resource[urlKey] = imageURLs[parseInt(Math.round(0.5 * (imgCount - 1)), 10)];
      });
      resp.push(resource);
    });
    // TODO: retrieve all resources
    return resp;
  }
}
