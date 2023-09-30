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
    resp.title = apiResponse.item.title;
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
      resp.facetsString = '';
      if ('search' in apiResponse) {
        const { search } = apiResponse;
        resp.facets = 'facet_limits' in search ? search.facet_limits.split('|') : [];
        if ('query' in search && search.query.length > 0) resp.facets.unshift(`query:"${search.query}"`);
        resp.facetsString = resp.facets.map((f) => `<span>${f}</span>`).join(', ');
      }
    }
  }
  return resp;
};

// function for creating an API URL based on current URL
const getAPIURL = (url) => {
  const apiURL = Utilities.appendParamsToURL(url, { fo: 'json', c: 150 });
  return apiURL;
};
